import pg from 'pg'

const sourceProspectorUrl = process.env.SOURCE_PROSPECTOR_DATABASE_URL
const targetProspectorUrl = process.env.TARGET_PROSPECTOR_DATABASE_URL
const sourceDesignUrl = process.env.SOURCE_DESIGN_DATABASE_URL

if (!sourceProspectorUrl || !targetProspectorUrl || !sourceDesignUrl) {
  throw new Error('SOURCE_PROSPECTOR_DATABASE_URL, TARGET_PROSPECTOR_DATABASE_URL e SOURCE_DESIGN_DATABASE_URL são obrigatórios.')
}

const clients = {
  sourceProspector: new pg.Client({ connectionString: sourceProspectorUrl }),
  targetProspector: new pg.Client({ connectionString: targetProspectorUrl }),
  sourceDesign: new pg.Client({ connectionString: sourceDesignUrl }),
  targetDesign: new pg.Client({ connectionString: targetProspectorUrl }),
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

async function tableNames(client, schema) {
  const result = await client.query(
    'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
    [schema],
  )
  return result.rows.map((row) => row.tablename)
}

async function tableDigest(client, schema, table, selectedColumns) {
  const columnResult = selectedColumns
    ? { rows: selectedColumns.map((column_name) => ({ column_name })) }
    : await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position`,
      [schema, table],
    )
  const columns = columnResult.rows.map((row) => row.column_name)
  if (!columns.length) throw new Error(`A tabela ${schema}.${table} não tem colunas visíveis.`)

  const pairs = columns
    .map((column) => `'${column.replaceAll("'", "''")}', row_data.${quoteIdentifier(column)}`)
    .join(', ')
  const rowJson = `jsonb_build_object(${pairs})::text`
  const result = await client.query(
    `SELECT count(*)::text AS row_count,
            md5(coalesce(string_agg(${rowJson}, E'\\n' ORDER BY ${rowJson}), '')) AS digest
       FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} AS row_data`,
  )

  return {
    columns,
    rowCount: Number(result.rows[0].row_count),
    digest: result.rows[0].digest,
  }
}

async function compareTable(mismatches, sourceClient, sourceSchema, targetClient, targetSchema, table, category) {
  const source = await tableDigest(sourceClient, sourceSchema, table)
  const targetColumnResult = await targetClient.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [targetSchema, table],
  )
  const targetColumns = new Set(targetColumnResult.rows.map((row) => row.column_name))
  const missingColumns = source.columns.filter((column) => !targetColumns.has(column))
  if (missingColumns.length) {
    mismatches.push({ category, table, reason: `missing target columns: ${missingColumns.join(', ')}` })
    return
  }
  const target = await tableDigest(targetClient, targetSchema, table, source.columns)
  if (
    source.rowCount !== target.rowCount
    || source.digest !== target.digest
  ) {
    mismatches.push({ category, table, sourceRows: source.rowCount, targetRows: target.rowCount })
  }
}

try {
  await Promise.all(Object.values(clients).map((client) => client.connect()))
  const mismatches = []
  const prospectorTables = [
    'campaigns',
    'theses',
    'content_items',
    'unified_creatives',
    'scheduled_publications',
    'content_variants',
    'thesis_revisions',
    'content_item_revisions',
    'content_publications',
    'content_assets',
  ]

  for (const table of prospectorTables) {
    await compareTable(mismatches, clients.sourceProspector, 'public', clients.targetProspector, 'public', table, 'prospector')
  }

  const sourceDesignTables = (await tableNames(clients.sourceDesign, 'public'))
    .filter((table) => table !== 'design_schema_migrations')
  const targetDesignTables = new Set(await tableNames(clients.targetDesign, 'design'))
  for (const table of sourceDesignTables) {
    if (!targetDesignTables.has(table)) {
      mismatches.push({ category: 'design', table, reason: 'missing target table' })
      continue
    }
    await compareTable(mismatches, clients.sourceDesign, 'public', clients.targetDesign, 'design', table, 'design')
  }

  const result = {
    status: mismatches.length ? 'mismatch' : 'exact',
    prospectorTables: prospectorTables.length,
    designTables: sourceDesignTables.length,
    mismatches,
  }
  console.log(JSON.stringify(result))
  if (mismatches.length) process.exitCode = 1
} finally {
  await Promise.all(Object.values(clients).map((client) => client.end().catch(() => undefined)))
}

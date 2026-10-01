import pg from 'pg'

const sourceUrl = process.env.DESIGN_SOURCE_DATABASE_URL
const targetUrl = process.env.DATABASE_URL
const apply = process.argv.includes('--apply')
const migrationVersion = 'design-data-2026-09-27-v1'
const migrationLock = 742901365

// Keep PostgreSQL date/time precision intact while rows pass through Node.
for (const oid of [1082, 1114, 1184]) {
  pg.types.setTypeParser(oid, (value) => value)
}

if (!sourceUrl || !targetUrl) {
  throw new Error('DESIGN_SOURCE_DATABASE_URL e DATABASE_URL são obrigatórios.')
}

const sourcePool = new pg.Pool({ connectionString: sourceUrl, max: 1 })
const targetPool = new pg.Pool({ connectionString: targetUrl, max: 1 })

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function relation(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
}

async function tableNames(client: pg.PoolClient, schema: string): Promise<string[]> {
  const result = await client.query<{ tablename: string }>(
    'select tablename from pg_tables where schemaname = $1 order by tablename',
    [schema],
  )
  return result.rows.map((row) => row.tablename)
}

async function rowCount(client: pg.PoolClient, schema: string, table: string): Promise<number> {
  const result = await client.query<{ count: string }>(`select count(*)::text as count from ${relation(schema, table)}`)
  return Number(result.rows[0]?.count ?? 0)
}

async function digest(client: pg.PoolClient, schema: string, table: string, names: string[]): Promise<string> {
  const object = names.map((name) => `'${name.replaceAll("'", "''")}', row_data.${quoteIdentifier(name)}`).join(', ')
  const value = `jsonb_build_object(${object})::text`
  const result = await client.query<{ digest: string }>(
    `select md5(coalesce(string_agg(${value}, E'\\n' order by ${value}), '')) as digest from ${relation(schema, table)} as row_data`,
  )
  return result.rows[0]?.digest ?? ''
}

type ColumnInfo = {
  name: string
  dataType: string
  udtSchema: string
  udtName: string
  nullable: string
  defaultValue: string | null
  characterMaximumLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  datetimePrecision: number | null
  identityGeneration: string | null
}

async function columns(client: pg.PoolClient, schema: string, table: string): Promise<ColumnInfo[]> {
  const result = await client.query<{
    column_name: string
    data_type: string
    udt_schema: string
    udt_name: string
    is_nullable: string
    column_default: string | null
    character_maximum_length: number | null
    numeric_precision: number | null
    numeric_scale: number | null
    datetime_precision: number | null
    identity_generation: string | null
  }>(
    `select column_name, data_type, udt_schema, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale, datetime_precision,
            identity_generation
       from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position`,
    [schema, table],
  )
  return result.rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    udtSchema: row.udt_schema,
    udtName: row.udt_name,
    nullable: row.is_nullable,
    defaultValue: row.column_default,
    characterMaximumLength: row.character_maximum_length,
    numericPrecision: row.numeric_precision,
    numericScale: row.numeric_scale,
    datetimePrecision: row.datetime_precision,
    identityGeneration: row.identity_generation,
  }))
}

async function copyOrder(client: pg.PoolClient, tables: string[]): Promise<string[]> {
  if (tables.length === 0) return []
  const constraints = await client.query<{ child: string; parent: string }>(
    `select child.relname as child, parent.relname as parent
       from pg_constraint fk
       join pg_class child on child.oid = fk.conrelid
       join pg_namespace child_ns on child_ns.oid = child.relnamespace
       join pg_class parent on parent.oid = fk.confrelid
       join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
      where fk.contype = 'f' and child_ns.nspname = 'design' and parent_ns.nspname = 'design'
        and child.relname = any($1::text[]) and parent.relname = any($1::text[])
      order by child.relname, parent.relname`,
    [tables],
  )
  const parents = new Map(tables.map((table) => [table, new Set<string>()]))
  for (const edge of constraints.rows) parents.get(edge.child)?.add(edge.parent)

  const ordered: string[] = []
  const pending = new Set(tables)
  while (pending.size) {
    const ready = [...pending].filter((table) => [...(parents.get(table) ?? [])].every((parent) => !pending.has(parent)))
    if (!ready.length) {
      const cycle = [...pending].sort()
      const populated = []
      for (const table of cycle) if (await rowCount(sourceClient!, 'public', table)) populated.push(table)
      if (populated.length) throw new Error(`Ciclo de FKs com dados exige mapeamento específico: ${populated.join(', ')}`)
      ordered.push(...cycle)
      break
    }
    ready.sort()
    ordered.push(...ready)
    for (const table of ready) pending.delete(table)
  }
  return ordered
}

let sourceClient: pg.PoolClient | undefined
let targetClient: pg.PoolClient | undefined

async function main(): Promise<void> {
try {
  sourceClient = await sourcePool.connect()
  targetClient = await targetPool.connect()
  await sourceClient.query('begin isolation level repeatable read read only')
  await targetClient.query(apply ? 'begin' : 'begin read only')
  if (apply) await targetClient.query(`select pg_advisory_xact_lock(${migrationLock})`)

  if (apply) {
    const markerTable = await targetClient.query<{ exists: boolean }>(
      "select to_regclass('design.design_data_migrations') is not null as exists",
    )
    if (markerTable.rows[0]?.exists) {
      const applied = await targetClient.query<{ version: string }>(
        'select version from design.design_data_migrations where version = $1',
        [migrationVersion],
      )
      if (applied.rows.length) {
        await targetClient.query('commit')
        await sourceClient.query('rollback')
        console.log(JSON.stringify({ status: 'already_applied', version: migrationVersion }))
        return
      }
    }
  }

  const databaseNames = await Promise.all([
    sourceClient.query<{ name: string }>('select current_database() as name'),
    targetClient.query<{ name: string }>('select current_database() as name'),
  ])
  const sourceDatabase = databaseNames[0].rows[0]?.name
  const targetDatabase = databaseNames[1].rows[0]?.name
  if (!sourceDatabase || !targetDatabase || sourceDatabase === targetDatabase) {
    throw new Error('Origem e destino precisam ser databases distintos.')
  }

  const sourceTables = (await tableNames(sourceClient, 'public')).filter((table) => table !== 'design_schema_migrations')
  const targetTables = await tableNames(targetClient, 'design')
  const targetTableSet = new Set(targetTables)
  const sourceCounts = new Map<string, number>()
  const missingTables: string[] = []
  const transferable: string[] = []

  for (const table of sourceTables) {
    const count = await rowCount(sourceClient, 'public', table)
    sourceCounts.set(table, count)
    if (!targetTableSet.has(table)) {
      if (count > 0) missingTables.push(table)
      continue
    }
    transferable.push(table)
  }

  if (missingTables.length) throw new Error(`Tabelas com dados sem destino no schema design: ${missingTables.join(', ')}`)

  const occupiedTables: string[] = []
  const tableReport: Array<{ table: string; rows: number; digest: string; columns: string[] }> = []
  for (const table of transferable.sort()) {
  const sourceColumns = await columns(sourceClient, 'public', table)
    const targetColumns = await columns(targetClient, 'design', table)
    const targetByName = new Map(targetColumns.map((column) => [column.name, column]))
    for (const sourceColumn of sourceColumns) {
      const targetColumn = targetByName.get(sourceColumn.name)
      if (!targetColumn
        || targetColumn.dataType !== sourceColumn.dataType
        || targetColumn.udtSchema !== sourceColumn.udtSchema
        || targetColumn.udtName !== sourceColumn.udtName
        || targetColumn.characterMaximumLength !== sourceColumn.characterMaximumLength
        || targetColumn.numericPrecision !== sourceColumn.numericPrecision
        || targetColumn.numericScale !== sourceColumn.numericScale
        || targetColumn.datetimePrecision !== sourceColumn.datetimePrecision) {
        throw new Error(`Coluna incompatível em public.${table}.${sourceColumn.name}.`)
      }
    }
    const sourceNames = new Set(sourceColumns.map((column) => column.name))
    const requiredTargetOnly = targetColumns.filter((column) => !sourceNames.has(column.name) && column.nullable === 'NO' && column.defaultValue === null)
    if (requiredTargetOnly.length) {
      throw new Error(`Colunas novas obrigatórias sem valor/default em design.${table}: ${requiredTargetOnly.map((column) => column.name).join(', ')}`)
    }
    const count = sourceCounts.get(table) ?? 0
    const targetCount = await rowCount(targetClient, 'design', table)
    if (targetCount > 0) occupiedTables.push(table)
    const names = sourceColumns.map((column) => column.name)
    tableReport.push({ table, rows: count, digest: await digest(sourceClient, 'public', table, names), columns: names })
  }
  if (occupiedTables.length) throw new Error(`Destino já contém dados em design: ${occupiedTables.join(', ')}`)

  const sourceTableSet = new Set(sourceTables)
  const unexpectedTargetData: string[] = []
  for (const table of targetTables) {
    if (sourceTableSet.has(table)) continue
    if (await rowCount(targetClient, 'design', table)) unexpectedTargetData.push(table)
  }
  if (unexpectedTargetData.length) {
    throw new Error(`Tabelas novas do destino já contêm dados: ${unexpectedTargetData.join(', ')}`)
  }

  const order = await copyOrder(targetClient, transferable)
  if (apply) {
    await targetClient.query(`create table if not exists design.design_data_migrations (
      version text primary key,
      source_database text not null,
      copied_tables integer not null,
      row_counts jsonb not null,
      copied_at timestamptz not null default now()
    )`)
    for (const table of order) {
        const tableColumns = await columns(sourceClient, 'public', table)
        if (!tableColumns.length) continue
        const names = tableColumns.map((column) => column.name)
        const sourceRows = await sourceClient.query(`select ${names.map(quoteIdentifier).join(', ')} from ${relation('public', table)}`)
        const targetColumns = await columns(targetClient, 'design', table)
        const identityColumns = targetColumns.filter((column) => column.identityGeneration !== null)
        const sequenceColumns = targetColumns.filter((column) =>
          column.identityGeneration !== null || column.defaultValue?.startsWith('nextval('),
        )
        if (identityColumns.some((column) => !names.includes(column.name))) {
          throw new Error(`Coluna identity inesperada em design.${table}.`)
        }
        const overrideIdentity = identityColumns.length ? ' overriding system value' : ''
        for (const row of sourceRows.rows) {
          const placeholders = names.map((_, index) => `$${index + 1}`).join(', ')
          await targetClient.query(
            `insert into ${relation('design', table)} (${names.map(quoteIdentifier).join(', ')})${overrideIdentity} values (${placeholders})`,
            names.map((name) => row[name]),
          )
        }
        for (const column of sequenceColumns) {
          const sequence = await targetClient.query<{ sequence_name: string | null }>(
            'select pg_get_serial_sequence($1, $2) as sequence_name',
            [relation('design', table), column.name],
          )
          const sequenceName = sequence.rows[0]?.sequence_name
          if (!sequenceName || !sourceRows.rowCount) continue
          const maximum = await targetClient.query<{ value: string | null }>(
            `select max(${quoteIdentifier(column.name)})::text as value from ${relation('design', table)}`,
          )
          if (maximum.rows[0]?.value !== null && maximum.rows[0]?.value !== undefined) {
            await targetClient.query('select setval($1::regclass, $2::bigint, true)', [sequenceName, maximum.rows[0].value])
          }
        }
    }

    const verification: Record<string, number> = {}
    for (const item of tableReport) {
      const targetCount = await rowCount(targetClient, 'design', item.table)
      const targetDigest = await digest(targetClient, 'design', item.table, item.columns)
      if (targetCount !== item.rows || targetDigest !== item.digest) {
        throw new Error(
          `Verificação falhou em design.${item.table}: origem ${item.rows}/${item.digest}, destino ${targetCount}/${targetDigest}.`,
        )
      }
      verification[item.table] = targetCount
    }
    await targetClient.query(
      'insert into design.design_data_migrations(version,source_database,copied_tables,row_counts) values($1,$2,$3,$4::jsonb)',
      [migrationVersion, sourceDatabase, Object.keys(verification).length, JSON.stringify(verification)],
    )
    await targetClient.query('commit')
    console.log(JSON.stringify({ status: 'applied', version: migrationVersion, sourceDatabase, targetDatabase, tables: verification }))
  } else {
    await targetClient.query('rollback')
    console.log(JSON.stringify({ status: 'dry_run', sourceDatabase, targetDatabase, tables: tableReport, copyOrder: order }))
  }
  await sourceClient.query('rollback')
} catch (error) {
  await targetClient?.query('rollback').catch(() => undefined)
  await sourceClient?.query('rollback').catch(() => undefined)
  throw error
} finally {
  targetClient?.release()
  sourceClient?.release()
  await Promise.all([targetPool.end(), sourcePool.end()])
}
}

await main()

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL é obrigatório para migrations.')

const migrationsDirectory = resolve(process.cwd(), 'drizzle')
const client = new pg.Client({ connectionString: databaseUrl })
const baselineExisting = process.env.DESIGN_MIGRATION_BASELINE_EXISTING === 'true'

const fingerprints: Record<string, string[]> = {
  '0000': ['users', 'brands', 'templates', 'creatives'],
  '0001': ['editorial_theses', 'editorial_campaigns', 'content_items'],
  '0002': ['creative_projects', 'ai_token_logs'],
  '0003': ['brand_profiles'],
}

async function tablesExist(tables: string[]): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`,
    [tables],
  )
  return Number(result.rows[0]?.count ?? 0) === tables.length
}

await client.connect()
try {
  await client.query('select pg_advisory_lock(742901364)')
  await client.query(`create table if not exists design_schema_migrations (
    version varchar(255) primary key,
    checksum varchar(64) not null,
    baseline boolean not null default false,
    applied_at timestamptz not null default now()
  )`)

  const files = (await readdir(migrationsDirectory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
  for (const file of files) {
    const sql = await readFile(resolve(migrationsDirectory, file), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const existing = await client.query<{ checksum: string }>('select checksum from design_schema_migrations where version = $1', [file])
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Checksum alterado para migration aplicada: ${file}`)
      continue
    }

    const prefix = file.slice(0, 4)
    if (baselineExisting && fingerprints[prefix] && await tablesExist(fingerprints[prefix]!)) {
      await client.query('insert into design_schema_migrations(version, checksum, baseline) values ($1, $2, true)', [file, checksum])
      console.info(`Baseline reconciliado: ${file}`)
      continue
    }

    await client.query('begin')
    try {
      for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) {
        await client.query(statement)
      }
      await client.query('insert into design_schema_migrations(version, checksum) values ($1, $2)', [file, checksum])
      await client.query('commit')
      console.info(`Migration aplicada: ${file}`)
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
} finally {
  await client.query('select pg_advisory_unlock(742901364)').catch(() => undefined)
  await client.end()
}

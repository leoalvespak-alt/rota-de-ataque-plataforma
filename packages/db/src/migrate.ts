import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createDatabase } from './index.js'

const direction = process.argv[2] === 'down' ? 'down' : 'up'
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const migrationsDir = path.resolve(import.meta.dirname, '../migrations')
const { pool } = createDatabase(databaseUrl)

async function readMigration(file: string): Promise<string> {
  const sql = await readFile(path.join(migrationsDir, file), 'utf8')
  return sql.replace(/^\uFEFF/u, '')
}

try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const accounts = await pool.query<{ exists: string | null }>("SELECT to_regclass('public.accounts')::text AS exists")
  if (accounts.rows[0]?.exists) await pool.query("INSERT INTO schema_migrations(version) VALUES('0001_initial') ON CONFLICT DO NOTHING")
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(`.${direction}.sql`)).sort()
  if (direction === 'up') {
    const applied = new Set((await pool.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((row) => row.version))
    for (const file of files) {
      const version = file.replace('.up.sql', '')
      if (applied.has(version)) continue
      const sql = await readMigration(file)
      const client = await pool.connect()
      try { await client.query('BEGIN'); await client.query(sql); await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]); await client.query('COMMIT') }
      catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
      console.log(`migration ${version} up complete`)
    }
  } else {
    const latest = (await pool.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')).rows[0]?.version
    if (!latest) throw new Error('No applied migration to roll back')
    const file = `${latest}.down.sql`
    if (!files.includes(file)) throw new Error(`Missing ${file}`)
    const client = await pool.connect()
    try { await client.query('BEGIN'); await client.query(await readMigration(file)); await client.query('DELETE FROM schema_migrations WHERE version=$1', [latest]); await client.query('COMMIT') }
    catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    console.log(`migration ${latest} down complete`)
  }
} finally { await pool.end() }

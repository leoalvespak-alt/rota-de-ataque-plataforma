import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'
import { migrationChecksums } from './migration-checksum'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL é obrigatório para migrations.')

const migrationsDirectory = resolve(process.cwd(), 'drizzle')
const client = new pg.Client({ connectionString: databaseUrl })
const baselineExisting = process.env.DESIGN_MIGRATION_BASELINE_EXISTING === 'true'
const migrationSchema = process.env.DESIGN_MIGRATION_SCHEMA ?? 'public'

if (!['public', 'design'].includes(migrationSchema)) {
  throw new Error('DESIGN_MIGRATION_SCHEMA deve ser public ou design.')
}

// The historical runner stored this ledger in public even when application
// migrations targeted the design schema. Keep standalone deployments on that
// ledger and isolate shared deployments under design.
const migrationTable = migrationSchema === 'design'
  ? '"design"."design_schema_migrations"'
  : '"public"."design_schema_migrations"'

const fingerprints: Record<string, string[]> = {
  '0000': ['users', 'brands', 'templates', 'creatives'],
  '0001': ['editorial_theses', 'editorial_campaigns', 'content_items'],
  '0002': ['creative_projects', 'ai_token_logs'],
  '0003': ['brand_profiles'],
}

async function tablesExist(schema: string, tables: string[]): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count from information_schema.tables where table_schema = $1 and table_name = any($2::text[])`,
    [schema, tables],
  )
  return Number(result.rows[0]?.count ?? 0) === tables.length
}

await client.connect()
try {
  await client.query('select pg_advisory_lock(742901364)')
  if (migrationSchema === 'design') await client.query('create schema if not exists design')
  await client.query(`create table if not exists ${migrationTable} (
    version varchar(255) primary key,
    checksum varchar(64) not null,
    baseline boolean not null default false,
    applied_at timestamptz not null default now()
  )`)

  if (migrationSchema === 'design') {
    const legacyTracker = await client.query<{ tracker_exists: boolean; can_read: boolean }>(
      `select to_regclass('public.design_schema_migrations') is not null as tracker_exists,
        case when to_regclass('public.design_schema_migrations') is null then true
             else has_table_privilege(current_user, to_regclass('public.design_schema_migrations'), 'SELECT')
        end as can_read`,
    )
    const currentCount = await client.query<{ count: string }>(
      `select count(*)::text as count from ${migrationTable}`,
    )

    // Do not replay old DDL into the shared database when the legacy public
    // ledger exists but its history has not been copied into the design schema.
    if (legacyTracker.rows[0]?.tracker_exists && Number(currentCount.rows[0]?.count ?? 0) === 0) {
      if (!legacyTracker.rows[0].can_read) {
        throw new Error(
          'O histórico public.design_schema_migrations existe, mas o role atual não pode lê-lo. ' +
          'Copie o ledger para design.design_schema_migrations com uma conexão administrativa antes das migrations.',
        )
      }

      const legacyRows = await client.query<{
        version: string
        checksum: string
        baseline: boolean
        applied_at: Date
      }>(
        'select version, checksum, baseline, applied_at from public.design_schema_migrations order by version',
      )
      for (const row of legacyRows.rows) {
        await client.query(
          `insert into ${migrationTable}(version, checksum, baseline, applied_at)
           values ($1, $2, $3, $4) on conflict (version) do nothing`,
          [row.version, row.checksum, row.baseline, row.applied_at],
        )
      }
      console.info(`Histórico de migrations importado: ${legacyRows.rowCount ?? 0}`)
    }
  }

  const files = (await readdir(migrationsDirectory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
  for (const file of files) {
    const sql = await readFile(resolve(migrationsDirectory, file), 'utf8')
    const { canonical: checksum, acceptedLegacy } = migrationChecksums(sql)
    const existing = await client.query<{ checksum: string }>(
      `select checksum from ${migrationTable} where version = $1`,
      [file],
    )
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        if (!acceptedLegacy.has(existing.rows[0].checksum)) {
          throw new Error(`Checksum alterado para migration aplicada: ${file}`)
        }
        await client.query(
          `update ${migrationTable} set checksum = $1 where version = $2`,
          [checksum, file],
        )
        console.info(`Checksum normalizado (LF/CRLF): ${file}`)
      }
      continue
    }

    const prefix = file.slice(0, 4)
    if (baselineExisting && fingerprints[prefix] && await tablesExist(migrationSchema, fingerprints[prefix]!)) {
      await client.query(
        `insert into ${migrationTable}(version, checksum, baseline) values ($1, $2, true)`,
        [file, checksum],
      )
      console.info(`Baseline reconciliado: ${file}`)
      continue
    }

    await client.query('begin')
    try {
      await client.query(`set local search_path to "${migrationSchema}", public`)

      // Migration 0032 predates the shared database and imports any visible
      // scheduled_publications table. When bootstrapping the Design schema in
      // the Prospector database, shadow that legacy relation with an empty
      // session-local table so the canonical Prospector schedule is not copied
      // into a second writable table.
      if (migrationSchema === 'design' && file.startsWith('0032_')) {
        await client.query(`create temporary table if not exists scheduled_publications (
          id uuid,
          thesis_id uuid,
          channel text,
          format text,
          status text,
          curation_status text,
          scheduled_for timestamptz,
          published_at timestamptz,
          approved_by text,
          batch_id uuid,
          title text,
          caption text,
          copy_data jsonb,
          origin text
        ) on commit preserve rows`)
      }

      let schemaSql = sql
      if (migrationSchema === 'design') {
        schemaSql = schemaSql.replace(/"public"\./gu, '"design".')
        schemaSql = schemaSql.replace(
          /CREATE EXTENSION IF NOT EXISTS (pgcrypto|vector);/giu,
          'CREATE EXTENSION IF NOT EXISTS $1 WITH SCHEMA public;',
        )
        if (file === '0004_secure_ai_gateway.sql') {
          schemaSql = schemaSql.replace(
            /INSERT INTO "users" \("id", "email", "name", "role"\)\s+VALUES \('00000000-0000-4000-8000-000000000001', 'operator@localhost\.invalid', 'Design System Operator', 'admin'\)\s+ON CONFLICT \("id"\) DO NOTHING;\s*/u,
            '',
          )
        }
      }
      for (const statement of schemaSql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) {
        await client.query(statement)
      }
      await client.query(
        `insert into ${migrationTable}(version, checksum) values ($1, $2)`,
        [file, checksum],
      )
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

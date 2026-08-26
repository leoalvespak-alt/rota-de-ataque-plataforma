import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTOMATION_ENGINES, ReasonCodeSchema } from '@plataforma/shared'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

async function migration(name: string) {
  return readFile(path.join(migrationsDirectory, name), 'utf8')
}

describe('migration file encoding', () => {
  it('does not ship SQL files with a UTF-8 BOM', async () => {
    const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql'))
    const contents = await Promise.all(files.map((file) => migration(file)))

    expect(contents.every((sql) => sql.charCodeAt(0) !== 0xfeff)).toBe(true)
  })
})

describe('unified 15-day batch migration', () => {
  it('removes publications before the opportunities they reference', async () => {
    const up = await migration('0031_unified_15day_batch.up.sql')
    const publicationsDelete = up.indexOf('DELETE FROM scheduled_publications')
    const opportunitiesDelete = up.indexOf('DELETE FROM content_opportunities')

    expect(publicationsDelete).toBeGreaterThan(-1)
    expect(opportunitiesDelete).toBeGreaterThan(publicationsDelete)
    expect(up).toMatch(/d15db4a0-2026-4a08-8a15-d00000000031/u)
    expect(up).toMatch(/content_opportunity_id IN[\s\S]*PLANO-DE-PUBLICACAO-15-DIAS%/u)
  })
})

describe('unified creatives migration', () => {
  it('resolves editorial plan items in either the Design or public schema', async () => {
    const up = await migration('0032_unified_creatives.up.sql')

    expect(up).toMatch(/to_regclass\('design\.editorial_plan_items'\)/u)
    expect(up).toMatch(/to_regclass\('public\.editorial_plan_items'\)/u)
    expect(up).toMatch(/attrelid = editorial_plan_items_table/u)
    expect(up).toMatch(/FROM %s epi/u)
    expect(up).not.toMatch(/FROM editorial_plan_items epi/u)
  })

  it('qualifies thesis mapping and audit tables across schemas', async () => {
    const up = await migration('0033_thesis_mapping.up.sql')
    const down = await migration('0033_thesis_mapping.down.sql')

    expect(up).toMatch(/to_regclass\('design\.editorial_theses'\)/u)
    expect(up).toMatch(/to_regclass\('public\.editorial_theses'\)/u)
    expect(up).toMatch(/INSERT INTO public\.audit_log/u)
    expect(up).not.toMatch(/ALTER TABLE editorial_theses/u)
    expect(down).toMatch(/editorial_theses_table regclass/u)
    expect(down).not.toMatch(/ALTER TABLE editorial_theses/u)
  })
})

describe('organic budget migration reconciliation', () => {
  it('extends the 0010 table instead of recreating or replacing it', async () => {
    const up = await migration('0015_budget_reservations.up.sql')

    expect(up).toMatch(/ALTER TABLE organic_budget_reservations[\s\S]*ADD COLUMN IF NOT EXISTS provider/u)
    expect(up).toMatch(/budget_id DROP NOT NULL/u)
    expect(up).toMatch(/research_run_id DROP NOT NULL/u)
    expect(up).toMatch(/status IN \('reserved', 'reconciled', 'released', 'refunded', 'expired'\)/u)
    expect(up).toMatch(/numeric\(18,4\)/u)
    expect(up).toMatch(/cardinality\(provider_candidates\.providers\) = 1/u)
    expect(up).not.toMatch(/CREATE TABLE IF NOT EXISTS organic_budget_reservations\s*\(/u)
  })

  it('keeps ambiguous legacy reservations reportable and rollback non-destructive', async () => {
    const up = await migration('0015_budget_reservations.up.sql')
    const down = await migration('0015_budget_reservations.down.sql')

    expect(up).toMatch(/organic_budget_reservation_quarantine/u)
    expect(up).toMatch(/provider_unresolved/u)
    expect(down).not.toMatch(/DROP TABLE IF EXISTS organic_budget_reservations/u)
    expect(down).toMatch(/ALTER COLUMN budget_id SET NOT NULL/u)
    expect(down).toMatch(/ALTER COLUMN research_run_id SET NOT NULL/u)
    expect(down).toMatch(/ALTER COLUMN estimated_usd TYPE numeric/u)
    expect(down).toMatch(/rollback blocked/u)
  })
})

describe('design schema migration', () => {
  it('does not require the Design System table on a Prospector-only database', async () => {
    const up = await migration('0011_design_schema.up.sql')

    expect(up).toMatch(/to_regclass\('design\.editorial_theses'\)/u)
    expect(up).toMatch(/NULL::uuid AS id/u)
    expect(up).toMatch(/WHERE false/u)
  })
})

describe('editorial doctrine seed migration', () => {
  it('adds candidate metadata before seeding the manual competitor sources', async () => {
    const up = await migration('0014_seed_doctrine.up.sql')
    const down = await migration('0014_seed_doctrine.down.sql')

    expect(up).toMatch(/ALTER TABLE candidate_sources[\s\S]*ADD COLUMN IF NOT EXISTS platform/u)
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS handle/u)
    expect(up).toMatch(/ADD COLUMN IF NOT EXISTS display_name/u)
    expect(down).toMatch(/DROP COLUMN IF EXISTS display_name/u)
  })
})

describe('automation engines migration', () => {
  it('maps every worker exactly once without changing enabled', async () => {
    const up = await migration('0034_automation_engines.up.sql')
    const reconciliation = await migration('0035_reconcile_automation_runtime.up.sql')
    const schema = `${up}\n${reconciliation}`
    const updates = [...schema.matchAll(/UPDATE worker_settings\s+SET ([\s\S]*?) WHERE worker_name = '([^']+)'/gu)]
    const workerNames = updates.map((match) => match[2])
    const migrationMapping = Object.fromEntries(updates.map((match) => {
      const engineKey = match[1]?.match(/engine_key\s*=\s*'([^']+)'/u)?.[1]
      return [match[2], engineKey]
    }))
    const catalogMapping = Object.fromEntries(AUTOMATION_ENGINES.flatMap((engine) => (
      engine.workers.map((workerName) => [workerName, engine.key])
    )))
    const effectiveMapping = {
      ...migrationMapping,
      'threads-adapter': 'M2',
      'reciprocity-detector': 'M6',
    }
    const schedulable = updates
      .filter((match) => /\bschedulable\s*=\s*true\b/u.test(match[1] ?? ''))
      .map((match) => match[2])
      .sort()

    expect(up.charCodeAt(0)).not.toBe(0xfeff)
    expect(new Set(workerNames).size).toBe(41)
    expect(effectiveMapping).toEqual(catalogMapping)
    expect(reconciliation).toMatch(/SET engine_key = 'M2',[\s\S]*WHERE worker_name = 'threads-adapter'/u)
    expect(reconciliation).toMatch(/SET engine_key = 'M6',[\s\S]*WHERE worker_name = 'reciprocity-detector'/u)
    expect(updates.every((match) => !/\benabled\s*=/u.test(match[1] ?? ''))).toBe(true)
    expect(schedulable).toEqual([
      'adaptive-crawler',
      'community-map',
      'competitive-intel',
      'data-quality',
      'email-flow-engine',
      'news-radar',
      'publisher',
      'reddit-intelligence',
      'threads-publisher',
    ])
    expect(up).toContain('ALTER TABLE worker_settings')
    expect(up).toContain('ADD COLUMN IF NOT EXISTS engine_key')
    expect(up).toMatch(/CREATE TABLE automation_engines/u)
    expect(up).toMatch(/CREATE TABLE engine_commands/u)
    expect(reconciliation).toMatch(/CREATE TABLE IF NOT EXISTS automation_reason_codes/u)
    expect(reconciliation).toMatch(/CREATE TABLE IF NOT EXISTS automation_incidents/u)
    expect(reconciliation).toMatch(/source_suggestion_id/u)
    for (const reasonCode of ReasonCodeSchema.options) {
      expect(reconciliation, `missing automation reason-code catalog entry: ${reasonCode}`).toContain(`('${reasonCode}'`)
    }
  })

  it('rolls back only the additive automation schema', async () => {
    const down = await migration('0034_automation_engines.down.sql')

    expect(down.charCodeAt(0)).not.toBe(0xfeff)
    expect(down).toMatch(/DROP TABLE IF EXISTS engine_commands/u)
    expect(down).toMatch(/DROP COLUMN IF EXISTS engine_key/u)
    expect(down).toMatch(/DROP TABLE IF EXISTS automation_engines/u)
    expect(down).not.toMatch(/\benabled\b/u)
    expect(down).not.toMatch(/DELETE FROM/u)
  })
})

describe('organic action state migration', () => {
  it('formalizes action state and makes organic derivations unique by source', async () => {
    const up = await migration('0016_organic_action_state.up.sql')
    const down = await migration('0016_organic_action_state.down.sql')

    expect(up).toMatch(/radar_findings[\s\S]*action_status/u)
    expect(up).toMatch(/promoted_publication_id uuid REFERENCES scheduled_publications/u)
    expect(up).toMatch(/competitor_insights[\s\S]*suggestion_created/u)
    expect(up).toMatch(/CREATE UNIQUE INDEX content_suggestions_organic_source_unique/u)
    expect(up).toMatch(/source_type IN \('radar', 'competitor'\)/u)
    expect(up).toMatch(/duplicates require reconciliation/u)
    expect(down).toMatch(/DROP COLUMN IF EXISTS promoted_publication_id/u)
    expect(down).not.toMatch(/DROP TABLE/u)
  })
})

describe('manual organic growth baseline migration', () => {
  it('seeds the six theses, seven safe calendar ideas and twenty priority topics idempotently', async () => {
    const up = await migration('0020_growth_organic_manual_baseline.up.sql')
    const down = await migration('0020_growth_organic_manual_baseline.down.sql')

    expect(up).toMatch(/direcao-vence-esforco/u)
    expect(up).toMatch(/concurso-policial-nao-acaba-na-objetiva/u)
    expect(up).toMatch(/erro-e-dado-nao-fracasso/u)
    expect(up).toMatch(/radar-policial-informacao-antes/u)
    expect(up).toMatch(/gente-comum-passa/u)
    expect(up).toMatch(/menos-material-mais-execucao/u)
    expect(up).toMatch(/growth-organic-baseline-v1/u)
    expect(up).toMatch(/'idea', 'instagram'/u)
    expect(up).toMatch(/source_type,title,description,suggested_format/u)
    expect(up.match(/name = 'Rota de Ataque'/gu)).toHaveLength(3)
    expect(up).toMatch(/ON CONFLICT \(campaign_id,slug,version\) DO NOTHING/u)
    expect(down).not.toMatch(/DELETE FROM theses/u)
  })

  it('removes an incorrectly seeded baseline from campaigns other than Rota de Ataque', async () => {
    const up = await migration('0021_scope_growth_baseline_to_rota.up.sql')
    const down = await migration('0021_scope_growth_baseline_to_rota.down.sql')

    expect(up).toMatch(/campaign\.name <> 'Rota de Ataque'/u)
    expect(up).toMatch(/DELETE FROM content_suggestions/u)
    expect(up).toMatch(/DELETE FROM scheduled_publications/u)
    expect(up).toMatch(/DELETE FROM theses/u)
    expect(down).not.toMatch(/INSERT INTO/u)
  })
})

describe('publication compatibility migration', () => {
  it('keeps unified_creatives as the write source and exposes a complete read projection', async () => {
    const up = await migration('0039_publication_compatibility.up.sql')
    const down = await migration('0039_publication_compatibility.down.sql')

    expect(up).toMatch(/ALTER TABLE unified_creatives[\s\S]*source_suggestion_id[\s\S]*external_id/u)
    expect(up).toMatch(/promoted_creative_id/u)
    expect(up).toMatch(/DROP VIEW IF EXISTS scheduled_publications_compat/u)
    expect(up).toMatch(/CREATE VIEW scheduled_publications_compat/u)
    expect(up).toMatch(/COALESCE\(external_id, id::text\)/u)
    expect(up).toMatch(/Writes belong to unified_creatives/u)
    expect(down).toMatch(/DROP COLUMN IF EXISTS external_id/u)
    expect(down).toMatch(/DROP COLUMN IF EXISTS promoted_creative_id/u)
  })
})

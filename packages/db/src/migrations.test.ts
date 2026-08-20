import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

async function migration(name: string) {
  return readFile(path.join(migrationsDirectory, name), 'utf8')
}

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

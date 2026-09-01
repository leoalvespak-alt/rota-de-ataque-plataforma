import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

describe('historical migrations remain immutable', () => {
  it('preserves the unified batch cleanup and the design schema guard', async () => {
    const batch = await migration('0031_unified_15day_batch.up.sql')
    expect(batch.indexOf('DELETE FROM content_opportunities')).toBeGreaterThan(batch.indexOf('DELETE FROM scheduled_publications'))
    expect(batch).toContain('d15db4a0-2026-4a08-8a15-d00000000031')

    const design = await migration('0011_design_schema.up.sql')
    expect(design).toMatch(/to_regclass\('design\.editorial_theses'\)/u)
    expect(design).toMatch(/WHERE false/u)
  })

  it('keeps additive budget and thesis mapping migrations non-destructive on rollback', async () => {
    const budget = await migration('0015_budget_reservations.up.sql')
    const budgetDown = await migration('0015_budget_reservations.down.sql')
    expect(budget).toMatch(/ALTER TABLE organic_budget_reservations[\s\S]*ADD COLUMN IF NOT EXISTS provider/u)
    expect(budget).toMatch(/organic_budget_reservation_quarantine/u)
    expect(budgetDown).not.toMatch(/DROP TABLE IF EXISTS organic_budget_reservations/u)

    const thesis = await migration('0033_thesis_mapping.up.sql')
    const thesisDown = await migration('0033_thesis_mapping.down.sql')
    expect(thesis).toMatch(/INSERT INTO public\.audit_log/u)
    expect(thesisDown).toMatch(/editorial_theses_table regclass/u)
  })
})

describe('editorial baseline migrations', () => {
  it('retains the six theses and idempotent baseline seeds', async () => {
    const up = await migration('0020_growth_organic_manual_baseline.up.sql')
    const down = await migration('0020_growth_organic_manual_baseline.down.sql')
    expect(up).toMatch(/direcao-vence-esforco/u)
    expect(up).toMatch(/concurso-policial-nao-acaba-na-objetiva/u)
    expect(up).toMatch(/growth-organic-baseline-v1/u)
    expect(up).toMatch(/ON CONFLICT \(campaign_id,slug,version\) DO NOTHING/u)
    expect(down).not.toMatch(/DELETE FROM theses/u)
  })

  it('keeps the publication compatibility projection on unified_creatives', async () => {
    const up = await migration('0039_publication_compatibility.up.sql')
    const down = await migration('0039_publication_compatibility.down.sql')
    expect(up).toMatch(/ALTER TABLE unified_creatives[\s\S]*source_suggestion_id[\s\S]*external_id/u)
    expect(up).toMatch(/CREATE VIEW scheduled_publications_compat/u)
    expect(up).toMatch(/Writes belong to unified_creatives/u)
    expect(down).toMatch(/DROP COLUMN IF EXISTS external_id/u)
  })
})

describe('Fase 8 legacy expurgo migration', () => {
  it('drops only audited legacy tables and removes old worker settings', async () => {
    const up = await migration('0040_prospector_expurgo_legacy.up.sql')
    expect(up).toMatch(/DELETE FROM worker_settings[\s\S]*content-item-orchestrator/u)
    expect(up).toMatch(/ALTER TABLE worker_settings DROP COLUMN IF EXISTS engine_key/u)
    for (const table of ['automation_engines', 'engine_commands', 'search_hits', 'search_terms', 'follower_deltas', 'follower_snapshots', 'live_events', 'live_interactions', 'crawl_schedule', 'crawl_schedule_history', 'reddit_watches', 'reddit_evidence', 'communities', 'community_edges', 'lead_community_membership', 'competitor_candidates', 'enrichment_jobs', 'alerts', 'notification_deliveries']) {
      expect(up).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }
    expect(up).not.toMatch(/CASCADE/u)
  })

  it('does not drop the active Radar/editorial tables', async () => {
    const up = await migration('0040_prospector_expurgo_legacy.up.sql')
    for (const table of ['news_sources', 'news_items', 'radar_findings', 'market_watches', 'research_runs', 'theses', 'content_opportunities', 'content_items', 'content_variants', 'unified_creatives', 'creative_bridge_deliveries', 'scheduled_publications']) {
      expect(up).not.toContain(`DROP TABLE IF EXISTS public.${table}`)
    }
  })
})

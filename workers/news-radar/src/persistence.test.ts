import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { persistNewsClassification } from './persistence.js'
import type { RadarClassification, RadarFinding } from './index.js'

const classification: RadarClassification = {
  concurso_alvo: 'PC', categoria: 'PC', estado: 'MG', banca: null, fase_ciclo: 'autorizacao',
  relevance_score: 0.91, confidence: 0.88, factuality_score: 0.9,
  is_police_relevant: true, is_duplicate: false, reason: 'Autorização publicada pela fonte.',
}
const finding: RadarFinding = {
  news_item_id: 'news-1', title: 'Concurso da Polícia Civil de MG autorizado', summary: 'Resumo da fonte.',
  source_url: 'https://example.com/noticia', source_name: 'Fonte oficial', concurso_alvo: 'PC', estado: 'MG', banca: null,
  fase_ciclo: 'autorizacao', categoria: 'PC', relevance_score: 0.91, confidence: 0.88, factuality_score: 0.9,
  review_status: 'review', auto_content_allowed: false, fingerprint: 'fingerprint-1',
}

function makePool(findingInserted: boolean, pautaStatus: string | null = null) {
  const client = {
    query: vi.fn(async (sql: string, _values?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.startsWith('UPDATE news_items')) return { rowCount: 1, rows: [] }
      if (sql.includes('FROM editorial.pauta_registry WHERE canonical_key')) {
        return pautaStatus ? { rows: [{ id: 'pauta-9', status: pautaStatus }] } : { rows: [] }
      }
      if (sql.includes('INSERT INTO editorial.pauta_registry')) return { rowCount: 1, rows: [{ id: 'pauta-1' }] }
      if (sql.includes('UPDATE editorial.pauta_registry')) return { rowCount: 1, rows: [] }
      if (sql.includes('INSERT INTO radar_findings')) return { rowCount: findingInserted ? 1 : 0, rows: findingInserted ? [{ id: 'finding-1' }] : [] }
      if (sql.includes("SELECT id FROM campaigns WHERE name = 'Rota de Ataque'")) return { rows: [{ id: 'campaign-1' }] }
      if (sql.includes('INSERT INTO content_opportunities')) return { rowCount: 1, rows: [{ id: 'opp-1' }] }
      if (sql.includes('FROM editorial.content_items WHERE opportunity_id')) return { rowCount: 0, rows: [] }
      if (sql.includes('INSERT INTO editorial.content_items')) return { rowCount: 1, rows: [{ id: 'item-1' }] }
      if (sql.includes('INSERT INTO editorial.unified_creatives')) return { rowCount: 2, rows: [] }
      if (sql.includes('INSERT INTO review_inbox')) return { rowCount: 1, rows: [] }
      if (sql.includes('INSERT INTO audit_log')) return { rowCount: 1, rows: [] }
      throw new Error(`Unexpected SQL in persistence test: ${sql}`)
    }),
    release: vi.fn(),
  }
  return { pool: { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, client }
}

describe('news finding persistence', () => {
  it('creates the linked opportunity in the same transaction as a new finding', async () => {
    const { pool, client } = makePool(true)
    const result = await persistNewsClassification(pool, 'news-1', classification, finding)

    expect(result).toEqual({ id: 'finding-1', isNew: true })
    const opportunityInsert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO content_opportunities'))
    expect(opportunityInsert?.[1]?.[6]).toBe('new')
    expect(JSON.stringify(opportunityInsert?.[1])).toContain('fingerprint-1')
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('does not create a second opportunity for a duplicate finding', async () => {
    const { pool, client } = makePool(false)
    await persistNewsClassification(pool, 'news-1', classification, finding)

    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO content_opportunities'))).toBe(false)
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })

  it('skips covered pautas instead of reposting them', async () => {
    const { pool, client } = makePool(true, 'posted')
    const result = await persistNewsClassification(pool, 'news-1', classification, finding)

    expect(result).toEqual({ id: '', isNew: false })
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO radar_findings'))).toBe(false)
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE editorial.pauta_registry'))).toBe(true)
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('approves the opportunity and drafts content for JEV auto-approved findings', async () => {
    const autoFinding: RadarFinding = {
      ...finding,
      review_status: 'approved',
      auto_content_allowed: true,
      auto_evidence: {
        jevPreserved: 0.91, minRelevance: 0.8, minConfidence: 0.8,
        minFactuality: 0.8, minPreserved: 0.8, trustedSource: 'pci concursos',
      },
    }
    const queries: string[] = []
    const client = {
      query: vi.fn(async (sql: string, _values?: unknown[]) => {
        queries.push(sql)
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
        if (sql.startsWith('UPDATE news_items')) return { rowCount: 1, rows: [] }
        if (sql.includes('FROM editorial.pauta_registry WHERE canonical_key')) return { rows: [] }
        if (sql.includes('INSERT INTO editorial.pauta_registry')) return { rowCount: 1, rows: [{ id: 'pauta-auto' }] }
        if (sql.includes('INSERT INTO radar_findings')) return { rowCount: 1, rows: [{ id: 'finding-auto' }] }
        if (sql.includes("SELECT id FROM campaigns WHERE name = 'Rota de Ataque'")) return { rows: [{ id: 'campaign-1' }] }
        if (sql.includes('INSERT INTO content_opportunities')) return { rowCount: 1, rows: [{ id: 'opp-auto' }] }
        if (sql.includes('FROM editorial.content_items WHERE opportunity_id')) return { rowCount: 0, rows: [] }
        if (sql.includes('INSERT INTO editorial.content_items')) return { rowCount: 1, rows: [{ id: 'item-auto' }] }
        if (sql.includes('INSERT INTO editorial.unified_creatives')) return { rowCount: 2, rows: [] }
        if (sql.includes('INSERT INTO review_inbox')) return { rowCount: 1, rows: [] }
        if (sql.includes('INSERT INTO audit_log')) return { rowCount: 1, rows: [] }
        throw new Error(`Unexpected SQL in persistence test: ${sql}`)
      }),
      release: vi.fn(),
    }
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool

    const result = await persistNewsClassification(pool, 'news-1', classification, autoFinding)

    expect(result).toEqual({ id: 'finding-auto', isNew: true })
    const opportunityInsert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO content_opportunities'))
    expect(opportunityInsert?.[1]?.[6]).toBe('approved')
    expect(JSON.stringify(opportunityInsert?.[1])).toContain('auto_approved')
    expect(queries.some((sql) => sql.includes('INSERT INTO editorial.content_items'))).toBe(true)
    expect(queries.some((sql) => sql.includes('INSERT INTO editorial.unified_creatives'))).toBe(true)
    expect(queries.some((sql) => sql.includes('INSERT INTO review_inbox'))).toBe(true)
    const auditCalls = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO audit_log'))
    expect(JSON.stringify(auditCalls.map((call) => call[1]))).toContain('content_opportunity.auto_approve')
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import type { RadarClassification, RadarFinding } from './index.js'
import { persistNewsClassification } from './persistence.js'

const classification = { categoria: 'PM', is_police_relevant: true } as RadarClassification
const finding = {
  news_item_id: 'item-1',
  title: 'Edital PM',
  summary: null,
  source_url: 'https://example.test/edital',
  source_name: 'Fonte oficial',
  concurso_alvo: 'PM',
  estado: 'SP',
  banca: null,
  fase_ciclo: 'edital_publicado',
  categoria: 'PM',
  relevance_score: 0.9,
  confidence: 0.9,
  factuality_score: 0.9,
  review_status: 'review',
  auto_content_allowed: false,
  fingerprint: 'fingerprint-1',
} as RadarFinding

function makePool(query: ReturnType<typeof vi.fn>) {
  const client = { query, release: vi.fn() } as unknown as PoolClient
  return { pool: { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, client }
}

describe('news-radar persistence', () => {
  it('commits classification and finding together and targets the partial fingerprint index', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'finding-1' }] })
      .mockResolvedValueOnce({})
    const { pool, client } = makePool(query)

    await expect(persistNewsClassification(pool, 'item-1', classification, finding)).resolves.toEqual({ id: 'finding-1', isNew: true })

    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']))
    expect(query.mock.calls[2]?.[0]).toContain('ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('rolls back classification when finding persistence fails', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockRejectedValueOnce(new Error('insert failed'))
      .mockResolvedValueOnce({})
    const { pool, client } = makePool(query)

    await expect(persistNewsClassification(pool, 'item-1', classification, finding)).rejects.toThrow('insert failed')

    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining(['BEGIN', 'ROLLBACK']))
    expect(query.mock.calls.map(([sql]) => String(sql))).not.toContain('COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })
})

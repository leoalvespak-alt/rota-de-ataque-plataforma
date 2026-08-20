import { describe, expect, it, vi } from 'vitest'
import { processNewsRadar, spec, type Repository, type AiClassifier } from './index.js'

describe('news-radar', () => {
  it('declares its worker contract', () => {
    expect(spec.queue).toBe('news-radar')
    expect(spec.outbound).toBe(false)
  })

  const makeRepo = (sources: any[] = [], items: any[] = []): Repository => ({
    getActiveSources: vi.fn().mockResolvedValue(sources),
    upsertNewsItem: vi.fn().mockResolvedValue({ id: 'item1', isNew: true }),
    markSourceFetched: vi.fn().mockResolvedValue(undefined),
    incrementSourceFailure: vi.fn().mockResolvedValue(undefined),
    disableSource: vi.fn().mockResolvedValue(undefined),
    getUnclassifiedItems: vi.fn().mockResolvedValue(items),
    markItemClassified: vi.fn().mockResolvedValue(undefined),
    insertRadarFinding: vi.fn().mockResolvedValue('finding1'),
  })

  it('classifies police-relevant items via keyword fallback', async () => {
    const repo = makeRepo([], [
      { id: 'i1', title: 'Edital publicado para PM Bahia 2026', summary: 'Concurso PM BA com 500 vagas', content: null, url: 'https://test.com/1', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai: null }, 'incremental')

    expect(result.classified).toBe(1)
    expect(result.findings).toBe(1)
    expect(repo.insertRadarFinding).toHaveBeenCalledWith(expect.objectContaining({
      concurso_alvo: 'PM',
      estado: 'BA',
      fase_ciclo: 'edital_publicado',
    }))
  })

  it('skips non-police items', async () => {
    const repo = makeRepo([], [
      { id: 'i2', title: 'Resultado do Enem 2026', summary: 'Notas divulgadas', content: null, url: 'https://test.com/2', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai: null }, 'incremental')

    expect(result.classified).toBe(1)
    expect(result.findings).toBe(0)
  })

  it('falls back to keyword when AI fails', async () => {
    const ai: AiClassifier = { classify: vi.fn().mockRejectedValue(new Error('AI unavailable')) }
    const repo = makeRepo([], [
      { id: 'i3', title: 'Concurso Polícia Civil PE - banca definida', summary: null, content: null, url: 'https://test.com/3', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai }, 'incremental')

    expect(ai.classify).toHaveBeenCalled()
    expect(result.findings).toBe(1)
    expect(repo.insertRadarFinding).toHaveBeenCalledWith(expect.objectContaining({
      concurso_alvo: 'PC',
      estado: 'PE',
      fase_ciclo: 'banca_definida',
    }))
  })

  it('disables source after 10 consecutive failures', async () => {
    const source = {
      id: 's1', name: 'Broken Feed', url: 'https://broken.com', feed_url: 'https://broken.com/rss',
      source_type: 'rss' as const, portal: 'test', active: true, etag: null, last_modified: null, failure_count: 9,
    }
    const repo = makeRepo([source])

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    try {
      await processNewsRadar({ repo, ai: null }, 'full')
      expect(repo.disableSource).toHaveBeenCalledWith('s1', expect.stringContaining('Auto-disabled'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

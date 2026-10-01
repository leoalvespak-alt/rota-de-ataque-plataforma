import { describe, expect, it, vi } from 'vitest'
import { makeTaskRequest, type TaskExecutionContext } from '@plataforma/task-runtime'

vi.mock('@plataforma/worker-content-item-orchestrator', () => ({
  composeSlotDecision: vi.fn(),
}))

import { composeSlotDecision } from '@plataforma/worker-content-item-orchestrator'
import { createSlotComposeTaskHandler } from './slot-compose.js'

const findingId = '660e8400-e29b-41d4-a716-446655440000'
const context: TaskExecutionContext = {
  runId: 'run-slot-1',
  attempt: 1,
  checkpoint: null,
  signal: new AbortController().signal,
  saveCheckpoint: async () => undefined,
}

const findingRow = {
  id: findingId,
  title: 'PMMG abre concurso com 90 vagas',
  summary: 'Edital da PMMG.',
  source_url: 'https://example.com/pmmg',
  source_name: 'PCI Concursos',
  categoria: 'PM',
  estado: 'MG',
  relevance_score: 0.95,
  confidence: 0.9,
  factuality_score: 0.85,
  content: null,
}

const decision = {
  findingId,
  contentType: 'noticia',
  postType: 'carrossel',
  templateIds: ['CrCover'],
  slides: [{ role: 'cover', title: 'T', body: 'B' }],
  caption: 'Legenda',
  hashtags: ['#pmmg'],
  cta: 'CTA',
  scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
  priority: 'P0',
  reviewMode: 'imediato',
  rationale: 'JEV alto.',
}

describe('slot.compose task handler', () => {
  it('persists composed decisions and emits completion events', async () => {
    vi.mocked(composeSlotDecision).mockResolvedValue({ ok: true, decision: decision as never, provider: 'primary' as const })
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [findingRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const handler = createSlotComposeTaskHandler({ query } as never)
    const result = await handler(
      makeTaskRequest('slot.compose', { findingId }, { occurrenceKey: `finding:${findingId}` }),
      context,
    )

    expect(composeSlotDecision).toHaveBeenCalledOnce()
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO editorial.slot_decisions'),
      expect.arrayContaining([findingId]),
    )
    expect(result.result).toMatchObject({ ok: true, findingId })
    expect(result.events?.[0]).toMatchObject({ eventType: 'slot.compose.completed' })
  })

  it('rejects payloads without a finding and fails closed on compose errors', async () => {
    const query = vi.fn()
    const handler = createSlotComposeTaskHandler({ query } as never)
    await expect(handler(
      makeTaskRequest('slot.compose', {}, { occurrenceKey: 'no-finding' }),
      context,
    )).rejects.toThrow('findingId')

    vi.mocked(composeSlotDecision).mockResolvedValue({ ok: false, error: 'slot_llm_failed' })
    const query2 = vi.fn()
      .mockResolvedValueOnce({ rows: [findingRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const handler2 = createSlotComposeTaskHandler({ query: query2 } as never)
    await expect(handler2(
      makeTaskRequest('slot.compose', { findingId }, { occurrenceKey: `finding:${findingId}` }),
      context,
    )).rejects.toThrow('slot.compose failed')
  })
})

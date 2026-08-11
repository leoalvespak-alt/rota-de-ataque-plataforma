import { describe, expect, it, vi } from 'vitest'
import { createExtractionProcessor, processJob, spec, type ExtractionRepository } from './index.js'

const preflight = { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY', accountRole: 'collector' as const }
describe('extraction', () => {
  it('declares its worker contract', () => { expect(spec.queue).toBe('extraction'); expect(typeof processJob).toBe('function') })
  it('deduplicates through the repository and schedules every new comment', async () => {
    const finishRun = vi.fn(async () => undefined)
    const repository: ExtractionRepository = { health: async () => ({ successRate: 1, checkpoints: 0, acknowledged: false }), startRun: async () => 'crawl', saveComment: async (_payload, comment) => ({ commentId: comment.externalId, leadId: `lead-${comment.externalId}`, inserted: comment.externalId !== '2' }), finishRun, pauseAccount: async () => undefined, alert: async () => undefined }
    const classification = vi.fn(async () => undefined)
    const extractor = { extract: async () => ['1', '2', '3'].map((id) => ({ externalId: id, username: `u${id}`, text: `comentário ${id}`, profileSnippet: {} })) }
    const result = await createExtractionProcessor(repository, { classification }, extractor)({ id: 'job', payload: { postId: 'post', campaignId: 'campaign', competitorId: 'competitor', accountId: 'collector', postUrl: 'https://instagram.com/p/a', commentCountShown: 3, runId: 'run' }, preflight })
    expect(classification).toHaveBeenCalledTimes(2)
    expect(finishRun).toHaveBeenCalledWith('crawl', expect.objectContaining({ itemsSeen: 3, itemsNew: 2, coverage: 1 }))
    expect(result.event.kind).toBe('extraction.completed')
  })
})

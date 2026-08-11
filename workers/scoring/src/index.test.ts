import { describe, expect, it, vi } from 'vitest'
import { createScoringProcessor, processJob, spec, type ScoringRepository } from './index.js'

const preflight = { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' }
describe('scoring', () => {
  it('declares its worker contract', () => { expect(spec.queue).toBe('scoring'); expect(typeof processJob).toBe('function') })
  it('uses campaign weights and persists a positive final score', async () => {
    const save = vi.fn(async () => undefined)
    const repository: ScoringRepository = { load: async () => ({ input: { comments: 3, posts: 1, competitors: 1, recency: 1, intent: .9, semantic: .9, relationship: .2, overlap: 0, freshnessDays: 0 }, weights: { comments: 10, posts: 5, competitors: 5, recency: 5, intent: 20, semantic: 10, relationship: 5, overlap: 2, lambdaFreshness: .05, p0: 80, p1: 50, p2: 25 }, previousPriority: 'P3' }), save }
    const result = await createScoringProcessor(repository)({ id: 'job', payload: { leadId: 'lead', campaignId: 'campaign', trigger: 'classification' }, preflight })
    expect(save).toHaveBeenCalledWith('lead', 'campaign', expect.objectContaining({ finalScore: expect.any(Number), priority: 'P1' }), 'P3')
    expect((result.event.payload as { finalScore: number }).finalScore).toBeGreaterThan(0)
  })
})

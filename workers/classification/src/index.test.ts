import { describe, expect, it, vi } from 'vitest'
import { createClassificationProcessor, processJob, spec, type ClassificationRepository } from './index.js'

const preflight = { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' }
describe('classification', () => {
  it('declares its worker contract', () => { expect(spec.queue).toBe('classification'); expect(typeof processJob).toBe('function') })
  it('embeds, classifies, persists and schedules scoring', async () => {
    const save = vi.fn<ClassificationRepository['save']>(async () => undefined)
    const scoring = vi.fn(async () => undefined)
    const repository: ClassificationRepository = { comment: async () => ({ text: 'Preciso de um curso para a próxima prova, quanto custa?' }), save }
    const nlp = { embed: async () => Array(384).fill(.1), complete: async () => JSON.stringify({ intent: 'purchase', topic: 'curso', sentiment: 'pos', purchase_signal: true, is_question: true, pain_point: 'preço', confidence: .94 }) }
    const result = await createClassificationProcessor(repository, { scoring }, nlp)({ id: 'job', payload: { commentId: 'comment', leadId: 'lead', campaignId: 'campaign', scope: 'competitor' }, preflight })
    expect(save).toHaveBeenCalledWith('comment', 'competitor', expect.objectContaining({ purchase_signal: true }), expect.any(Array))
    expect(save.mock.calls[0]?.[3]).toHaveLength(384)
    expect(scoring).toHaveBeenCalledWith('lead', 'campaign')
    expect(result.event.kind).toBe('classification.completed')
  })
})

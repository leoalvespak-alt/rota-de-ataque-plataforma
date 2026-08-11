import { describe, expect, it } from 'vitest'
import { createExtractionProcessor, type ExtractionRepository } from '@plataforma/worker-extraction'
import { createClassificationProcessor, type ClassificationRepository } from '@plataforma/worker-classification'
import { createScoringProcessor, type ScoringRepository } from './index.js'

const basePreflight = { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' }
describe('intelligence pipeline integration', () => {
  it('turns one mocked competitor post with three comments into a positive lead score', async () => {
    const comments = new Map<string, string>()
    let classifications = 0
    let finalScore = 0
    const scoringRepository: ScoringRepository = {
      load: async () => ({ input: { comments: classifications, posts: 1, competitors: 1, recency: 1, intent: .9, semantic: .9, relationship: 0, overlap: 0, freshnessDays: 0 }, weights: { comments: 10, posts: 5, competitors: 5, recency: 5, intent: 20, semantic: 10, relationship: 1, overlap: 1, lambdaFreshness: .05, p0: 80, p1: 50, p2: 25 } }),
      save: async (_leadId, _campaignId, result) => { finalScore = result.finalScore },
    }
    const score = createScoringProcessor(scoringRepository)
    const classificationRepository: ClassificationRepository = {
      comment: async (_scope, id) => comments.has(id) ? { text: comments.get(id)! } : null,
      save: async () => { classifications += 1 },
    }
    const classify = createClassificationProcessor(classificationRepository, { scoring: (leadId, campaignId) => score({ id: `score-${classifications}`, payload: { leadId, campaignId, trigger: 'classification' }, preflight: basePreflight }).then(() => undefined) }, { embed: async () => Array(384).fill(.01), complete: async () => JSON.stringify({ intent: 'purchase', topic: 'curso', sentiment: 'pos', purchase_signal: true, is_question: true, pain_point: 'aprovação', confidence: .9 }) })
    const extractionRepository: ExtractionRepository = {
      health: async () => ({ successRate: 1, checkpoints: 0, acknowledged: false }), startRun: async () => 'run',
      saveComment: async (_payload, comment) => { comments.set(comment.externalId, comment.text); return { commentId: comment.externalId, leadId: 'lead', inserted: true } },
      finishRun: async () => undefined, pauseAccount: async () => undefined, alert: async () => undefined,
    }
    const extract = createExtractionProcessor(extractionRepository, { classification: (commentId, payload) => classify({ id: `classification-${commentId}`, payload: payload as never, preflight: basePreflight }).then(() => undefined) }, { extract: async () => [1, 2, 3].map((id) => ({ externalId: String(id), username: 'lead-real', text: `Quero comprar o curso ${id}; qual é o preço?`, profileSnippet: {} })) })
    await extract({ id: 'post:mock:extraction:run', payload: { postId: 'post', campaignId: 'campaign', competitorId: 'competitor', accountId: 'collector', postUrl: 'https://instagram.com/p/mock', commentCountShown: 3, runId: 'run' }, preflight: { ...basePreflight, accountRole: 'collector' } })
    expect(classifications).toBe(3)
    expect(finalScore).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'
import { accountRisk, adaptiveInterval, assertDmInbound, assertRole, computeScore, deriveStage, deterministicJobId, EMBEDDING_DIM, extractionCoverage, loadConfig, preflight, sourceRoi, withinDmWindow } from './index.js'

const readyPreflight = {
  migrationsCurrent: true,
  embeddingDimension: EMBEDDING_DIM,
  tokenValid: true,
  lockAvailable: true,
  budgetAvailable: true,
  accountStatus: 'HEALTHY',
  accountRole: 'collector' as const,
}

describe('preflight', () => {
  it.each([
    [{ migrationsCurrent: false }, 'MIGRATION_DRIFT'],
    [{ embeddingDimension: EMBEDDING_DIM + 1 }, 'PREREQUISITE_MISSING'],
    [{ tokenValid: false }, 'PROVIDER_NOT_CONFIGURED'],
    [{ lockAvailable: false }, 'PREREQUISITE_MISSING'],
    [{ budgetAvailable: false }, 'BUDGET_NOT_CONFIGURED'],
    [{ accountStatus: 'STOPPED' }, 'ACCOUNT_AUTH_REQUIRED'],
  ])('classifies a failed prerequisite', (override, reasonCode) => {
    expect(() => preflight({ ...readyPreflight, ...override }, 'collector')).toThrow(
      expect.objectContaining({ reasonCode }),
    )
  })

  it('reports an account-role mismatch', () => {
    expect(() => preflight(readyPreflight, 'actor')).toThrow(
      expect.objectContaining({ reasonCode: 'ROLE_MISMATCH' }),
    )
  })
})

describe('shared domain contracts', () => {
  it('keeps embeddings fixed and rejects external providers', () => {
    expect(EMBEDDING_DIM).toBe(384)
    expect(() => loadConfig({ DATABASE_URL: 'postgresql://x:x@localhost/x', REDIS_URL: 'redis://localhost', APP_URL: 'https://example.com', META_APP_SECRET: 'x', META_WEBHOOK_VERIFY_TOKEN: 'x', EMBEDDINGS_PROVIDER: 'openai', EMBEDDINGS_MODEL: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', EMBEDDINGS_ENDPOINT: 'http://localhost:8080', EMBEDDING_DIM: '384', TOKEN_ENCRYPTION_KEY: 'x'.repeat(32) })).toThrow()
  })
  it('enforces account roles and inbound-only DM', () => {
    expect(() => assertRole('collector', 'follow')).toThrow(/cannot execute/)
    expect(() => assertDmInbound('cold')).toThrow(/Cold DM/)
    expect(() => assertDmInbound('inbound')).not.toThrow()
  })
  it('computes layered score and stage', () => {
    const score = computeScore({ comments: 2, posts: 1, competitors: 1, recency: 1, intent: 2, semantic: 1, relationship: 1, overlap: 2, freshnessDays: 0 }, { comments: 2, posts: 1, competitors: 1, recency: 1, intent: 3, semantic: 1, relationship: 2, overlap: 1, lambdaFreshness: .05, p0: 10, p1: 5, p2: 2 })
    expect(score.priority).toBe('P0')
    expect(deriveStage('in_conversation')).toBe('engaged')
    expect(deterministicJobId('scoring', ['a', 1])).toBe('scoring:a:1')
  })
  it('applies operational guardrails', () => {
    expect(accountRisk({ successRate: .5, apiErrorRate: .5, checkpoints: 2, authErrors: 1, latencyMs: 8_000 }).status).toBe('STOPPED')
    expect(extractionCoverage(60, 100)).toBe(.6)
    expect(adaptiveInterval({ current: 100, min: 50, max: 400, sourceScore: .9, generated: 2, emptyRuns: 0, budgetPressure: 0, locked: false }).interval).toBeLessThan(100)
    expect(sourceRoi({ followbackRate: 1, retention30dRate: 1, interactionRate: 1, dmReplyRate: 1, conversionRate: 1, normalizedCost: 1 }, { fb: 1, ret: 1, interaction: 1, dm: 1, conversion: 1, cost: 1 })).toBe(4)
    expect(withinDmWindow(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T01:00:00Z'))).toBe(false)
  })
})

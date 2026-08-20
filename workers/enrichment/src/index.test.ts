import { describe, expect, it } from 'vitest'
import { makeWorkerJob } from '@plataforma/shared/worker'
import { executeEnrichmentJob, type EnrichmentObservation, type EnrichmentPayload, type EnrichmentRuntime, EnrichmentError, processJob, spec } from './index.js'

const ids = {
  run: '00000000-0000-4000-8000-000000000001',
  observation: '00000000-0000-4000-8000-000000000002',
  correlation: '00000000-0000-4000-8000-000000000003',
}

const payload: EnrichmentPayload = {
  researchRunId: ids.run,
  observationId: ids.observation,
  provider: 'exa',
  platform: 'web',
  correlationId: ids.correlation,
  inputVersion: 'exa-search-v1',
  enrichmentVersion: 'enrichment-v1',
  estimatedCostUsd: 0.02,
  nextQueue: 'content-opportunity',
  operation: 'enrich',
  maxAgeMinutes: 60,
  timeoutMs: 50,
}

const observation: EnrichmentObservation = {
  id: ids.observation,
  researchRunId: ids.run,
  provider: 'exa',
  platform: 'web',
  externalId: 'external-1',
  canonicalUrl: 'https://example.com/article',
  logicalEntityKey: 'web:example.com:article',
  authorExternalId: 'author-1',
  title: 'Article',
  textContent: 'Useful article text',
  metrics: {},
  rawSchemaVersion: 'exa-search-v1',
  observedAt: new Date().toISOString(),
  publishedAt: null,
}

function runtime(overrides: Partial<EnrichmentRuntime> = {}): EnrichmentRuntime & { counters: Record<string, number> } {
  const counters = { persisted: 0, reconciled: 0, released: 0, enqueued: 0, completed: 0, failed: 0 }
  const value: EnrichmentRuntime = {
    claim: async () => 'claimed',
    loadObservation: async () => observation,
    reserveBudget: async () => ({ reservationId: 'reservation-1' }),
    enrich: async () => ({ classification: 'source', displayName: 'Article', confidence: 0.9, actualCostUsd: 0.01 }),
    persistEnrichment: async () => { counters.persisted += 1 },
    reconcileBudget: async () => { counters.reconciled += 1 },
    releaseBudget: async () => { counters.released += 1 },
    enqueueNext: async () => { counters.enqueued += 1 },
    markCompleted: async () => { counters.completed += 1 },
    markFailed: async () => { counters.failed += 1 },
    ...overrides,
  }
  return Object.assign(value, { counters })
}

const job = (input: EnrichmentPayload = payload) => makeWorkerJob(input, { id: 'enrichment-test-job' })

async function expectReason(promise: Promise<unknown>, reasonCode: string) {
  await expect(promise).rejects.toMatchObject({ reasonCode })
}

describe('enrichment worker', () => {
  it('declares a versioned worker and process function', () => {
    expect(spec.queue).toBe('enrichment')
    expect(typeof processJob).toBe('function')
  })

  it('reserves, normalizes, persists, reconciles and enqueues exactly once', async () => {
    const fake = runtime()
    const result = await executeEnrichmentJob(job(), fake)
    expect(result.event.kind).toBe('enrichment.completed')
    expect(fake.counters).toEqual({ persisted: 1, reconciled: 1, released: 0, enqueued: 1, completed: 1, failed: 0 })
  })

  it('returns a deduplicated event for an already completed idempotency key', async () => {
    const fake = runtime({ claim: async () => 'completed' })
    const result = await executeEnrichmentJob(job(), fake)
    expect(result.event.kind).toBe('enrichment.deduplicated')
    expect(fake.counters.persisted).toBe(0)
  })

  it('rejects stale input before spending budget', async () => {
    const fake = runtime({ loadObservation: async () => ({ ...observation, rawSchemaVersion: 'old-version' }) })
    await expectReason(executeEnrichmentJob(job(), fake), 'ENRICHMENT_STALE_INPUT')
    expect(fake.counters.released).toBe(0)
    expect(fake.counters.failed).toBe(1)
  })

  it('classifies incomplete provider payload as permanent content insufficiency and releases the reservation', async () => {
    const fake = runtime({ enrich: async () => ({ displayName: 'No classification' }) })
    await expectReason(executeEnrichmentJob(job(), fake), 'CONTENT_INSUFFICIENT')
    expect(fake.counters.released).toBe(1)
    expect(fake.counters.persisted).toBe(0)
  })

  it('maps budget blocks and provider timeouts to explicit retry reasons', async () => {
    const budgetError = Object.assign(new Error('budget'), { code: 'BUDGET_EXCEEDED' })
    const blocked = runtime({ reserveBudget: async () => { throw budgetError } })
    await expectReason(executeEnrichmentJob(job(), blocked), 'BUDGET_EXCEEDED')

    const timedOut = runtime({ enrich: async (_observation, _job, signal) => new Promise<never>((_, reject) => { signal.addEventListener('abort', () => reject(new EnrichmentError('aborted', 'ENRICHMENT_TIMEOUT', true))) }) })
    await expectReason(executeEnrichmentJob(job({ ...payload, timeoutMs: 5 }), timedOut), 'ENRICHMENT_TIMEOUT')
    expect(timedOut.counters.released).toBe(1)
  })
})

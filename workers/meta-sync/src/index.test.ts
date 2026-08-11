import { describe, expect, it, vi } from 'vitest'
import { createMetaSyncProcessor, processJob, spec, type MetaSyncApi, type MetaSyncRepository } from './index.js'

const preflight = { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY', accountRole: 'actor' as const }
describe('meta-sync', () => {
  it('declares its worker contract', () => { expect(spec.queue).toBe('meta-sync'); expect(typeof processJob).toBe('function') })
  it('persists a new competitor post and schedules extraction once', async () => {
    const extraction = vi.fn(async () => undefined)
    const repository: MetaSyncRepository = { activeCompetitors: async () => [{ campaignId: 'campaign', competitorId: 'competitor', username: 'real' }], updateCompetitor: vi.fn(async () => undefined), upsertPost: async () => ({ id: 'post', inserted: true }), saveOwnSnapshot: async () => undefined, incrementRateLimit: async () => undefined }
    const api = { businessDiscovery: async () => ({ business_discovery: { username: 'real', media: { data: [{ id: 'media', permalink: 'https://instagram.com/p/abc/', comments_count: 3 }] } } }), self: {} } as unknown as MetaSyncApi
    const result = await createMetaSyncProcessor(repository, { extraction }, api)({ id: 'job', payload: { kind: 'competitor', accountId: 'actor', collectorAccountId: 'collector', igUserId: 'ig', runId: 'run' }, preflight })
    expect(result.event.kind).toBe('meta-sync.completed')
    expect(extraction).toHaveBeenCalledWith('post', 'run', expect.objectContaining({ campaignId: 'campaign', accountId: 'collector', accountRole: 'collector' }))
  })
})

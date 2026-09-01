import { describe, expect, it } from 'vitest'
import { createContentItemOrchestrator } from './index.js'

describe('content item orchestration', () => it('returns a deferred dispatch plan for requested channels', async () => {
  const process = createContentItemOrchestrator({ get: async () => ({ id: 'item', frozenAt: null, parentId: null, brandVoiceVersion: 'v1', campaignActive: true, actorHealthy: true }) })
  const result = await process({ id: 'job', payload: { contentItemId: 'item', channels: ['threads', 'email'] }, preflight: { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' } })
  expect(result.event.payload).toMatchObject({ contentItemId: 'item', plannedChannels: ['threads', 'email'], dispatch: 'deferred_to_post_queue_runtime' })
}))

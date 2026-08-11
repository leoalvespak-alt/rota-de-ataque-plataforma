import { describe, expect, it } from 'vitest'
import { createContentItemOrchestrator } from './index.js'

describe('content item orchestration', () => it('creates one idempotent job per requested channel', async () => {
  const jobs: string[] = []
  const process = createContentItemOrchestrator({ get: async () => ({ id: 'item', frozenAt: null, parentId: null, brandVoiceVersion: 'v1', campaignActive: true, actorHealthy: true }) }, { enqueue: async (_queue, jobId) => { jobs.push(jobId) } })
  await process({ id: 'job', payload: { contentItemId: 'item', channels: ['threads', 'email'] }, preflight: { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' } })
  expect(jobs).toHaveLength(2)
}))

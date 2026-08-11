import { describe, expect, it } from 'vitest'
import { createThreadsAdapter } from './index.js'
describe('threads adapter', () => it('rejects posts over 500 chars', async () => {
  const process = createThreadsAdapter({ get: async () => ({ id: 'item', campaignId: 'campaign', angle: 'a', hook: 'h', arguments: [], brandVoiceVersion: 'v1' }), recentTexts: async () => [], save: async () => 'variant', createReview: async () => undefined }, async () => 'x'.repeat(501))
  await expect(process({ id: 'job', payload: { contentItemId: 'item' }, preflight: { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY' } })).rejects.toThrow()
}))

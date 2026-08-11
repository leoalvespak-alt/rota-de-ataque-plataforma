import { describe, expect, it } from 'vitest'
import { createThreadsPublisher } from './index.js'

describe('threads publisher', () => it('requires a human-approved variant', async () => {
  const process = createThreadsPublisher({ get: async () => ({ id: 'variant', userId: 'user', text: 'texto', status: 'ready', rateUsed24h: 0 }), complete: async () => undefined }, () => ({ createContainer: async () => ({ id: 'container' }), publishContainer: async () => ({ id: 'published' }) } as never))
  await expect(process({ id: 'job', payload: { variantId: 'variant' }, preflight: { migrationsCurrent: true, embeddingDimension: 384, tokenValid: true, lockAvailable: true, budgetAvailable: true, accountStatus: 'HEALTHY', accountRole: 'actor' } })).rejects.toThrow()
}))

import { describe, expect, it } from 'vitest'
import { SesProvider } from './index.js'

describe('SES event parser', () => {
  it('normalizes delivery webhooks', () => {
    const provider = new SesProvider({ send: async () => ({ messageId: 'x' }) })
    expect(provider.parseWebhook({ eventType: 'Delivery', mail: { messageId: 'm', destination: ['a@example.com'] }, notification: { timestamp: '2026-01-01T00:00:00Z' } })).toMatchObject([{ kind: 'delivered', messageId: 'm' }])
  })
})

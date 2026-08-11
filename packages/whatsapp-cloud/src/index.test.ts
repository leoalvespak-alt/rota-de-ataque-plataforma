import { describe, expect, it } from 'vitest'
import { parseWhatsAppWebhook, verifyWhatsAppSignature } from './index.js'
describe('whatsapp cloud', () => it('rejects a missing webhook signature', () => expect(verifyWhatsAppSignature(Buffer.from('body'), null, 'secret')).toBe(false)))

it('parses inbound and delivery webhooks', () => {
  const events = parseWhatsAppWebhook({ entry: [{ changes: [{ value: { messages: [{ id: 'in', from: '5511', text: { body: 'oi' } }], statuses: [{ id: 'out', status: 'delivered' }] } }] }] })
  expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'message', text: 'oi' }), expect.objectContaining({ kind: 'status', status: 'delivered' })]))
})

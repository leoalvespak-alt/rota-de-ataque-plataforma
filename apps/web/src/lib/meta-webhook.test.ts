import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  META_WEBHOOK_MAX_BODY_BYTES,
  MetaWebhookBodyTooLargeError,
  parseMetaWebhookPayload,
  readMetaWebhookBody,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from './meta-webhook'

const appSecret = 'meta-app-secret-for-tests'

function signature(body: Uint8Array) {
  return `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`
}

describe('Meta webhook request authentication', () => {
  it('checks the HMAC over the exact raw request bytes', () => {
    const body = Buffer.from('{"entry":[]}')
    expect(verifyMetaWebhookSignature(body, signature(body), appSecret)).toBe(true)
    expect(verifyMetaWebhookSignature(Buffer.from('{ "entry":[]}'), signature(body), appSecret)).toBe(false)
    expect(verifyMetaWebhookSignature(body, null, appSecret)).toBe(false)
    expect(verifyMetaWebhookSignature(body, signature(body), undefined)).toBe(false)
    expect(verifyMetaWebhookSignature(body, 'sha256=bad', appSecret)).toBe(false)
  })

  it('accepts only a matching subscribe challenge', () => {
    expect(verifyMetaWebhookChallenge('subscribe', 'verify-me', 'verify-me')).toBe(true)
    expect(verifyMetaWebhookChallenge('subscribe', 'other', 'verify-me')).toBe(false)
    expect(verifyMetaWebhookChallenge('unsubscribe', 'verify-me', 'verify-me')).toBe(false)
    expect(verifyMetaWebhookChallenge('subscribe', 'verify-me', undefined)).toBe(false)
  })

  it('reads bounded bodies and rejects a payload that crosses the limit', async () => {
    const body = await readMetaWebhookBody(new Request('https://local.test', { method: 'POST', body: 'small' }), 8)
    expect(body.toString()).toBe('small')
    await expect(readMetaWebhookBody(
      new Request('https://local.test', { method: 'POST', body: 'too large' }),
      4,
    )).rejects.toBeInstanceOf(MetaWebhookBodyTooLargeError)
    expect(META_WEBHOOK_MAX_BODY_BYTES).toBe(1_048_576)
  })
})

describe('Meta webhook normalization', () => {
  it('normalizes comments and inbound messages while excluding echoes and outbound events', () => {
    const events = parseMetaWebhookPayload({
      object: 'instagram',
      entry: [{
        id: 'account-1',
        changes: [{ field: 'comments', value: {
          id: 'comment-1',
          from: { id: 'person-1', username: 'must-not-be-stored' },
          media: { id: 'media-1' },
          text: 'Onde encontro o edital?',
          timestamp: 1_790_000_000_000,
        } }],
        messaging: [
          { sender: { id: 'person-2' }, timestamp: 1_790_000_000_100, message: { mid: 'message-1', text: 'Pode mandar o material?' } },
          { sender: { id: 'account-1' }, timestamp: 1_790_000_000_200, message: { mid: 'outbound-1', text: 'Resposta' } },
          { sender: { id: 'person-3' }, timestamp: 1_790_000_000_300, message: { mid: 'echo-1', text: 'Resposta', is_echo: true } },
        ],
      }],
    }, appSecret)

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      eventKind: 'comment',
      externalEventId: 'comment-1',
      senderExternalId: 'person-1',
      mediaExternalId: 'media-1',
      textContent: 'Onde encontro o edital?',
      contentType: 'text',
      replyWindowExpiresAt: new Date(1_790_000_000_000 + 7 * 24 * 60 * 60 * 1_000).toISOString(),
    })
    expect(events[1]).toMatchObject({
      eventKind: 'direct_message',
      externalEventId: 'message-1',
      senderExternalId: 'person-2',
      textContent: 'Pode mandar o material?',
      replyWindowExpiresAt: null,
    })
    expect(JSON.stringify(events)).not.toContain('must-not-be-stored')
    expect(events.every((event) => /^[0-9a-f]{64}$/u.test(event.revisionHash))).toBe(true)
  })

  it('fingerprints repeats consistently and records edited comments as a new revision', () => {
    const comment = (text: string) => ({
      object: 'instagram',
      entry: [{ id: 'account-1', changes: [{ field: 'comments', value: { id: 'comment-1', text, timestamp: 1_790_000_000_000 } }] }],
    })
    const original = parseMetaWebhookPayload(comment('Qual é a data?'), appSecret)[0]!
    const repeated = parseMetaWebhookPayload(comment('Qual é a data?'), appSecret)[0]!
    const edited = parseMetaWebhookPayload(comment('Qual é o local?'), appSecret)[0]!
    expect(repeated.revisionHash).toBe(original.revisionHash)
    expect(edited.revisionHash).not.toBe(original.revisionHash)
  })

  it('keeps attachment metadata without retaining expiring URLs', () => {
    const events = parseMetaWebhookPayload({
      object: 'instagram',
      entry: [{
        id: 'account-1',
        messaging: [{ sender: { id: 'person-4' }, timestamp: 1_790_000_000_000, message: {
          mid: 'attachment-1',
          attachments: [{ type: 'image', payload: { url: 'https://cdn.example/private-image' } }],
        } }],
      }],
    }, appSecret)
    expect(events[0]).toMatchObject({ contentType: 'attachment', textContent: null })
    expect(JSON.stringify(events)).not.toContain('cdn.example')
  })

  it('ignores unsupported or malformed provider payloads', () => {
    expect(parseMetaWebhookPayload({ object: 'page', entry: [] }, appSecret)).toEqual([])
    expect(parseMetaWebhookPayload({ object: 'instagram', entry: [{ id: '', changes: [] }] }, appSecret)).toEqual([])
    expect(parseMetaWebhookPayload({}, appSecret)).toEqual([])
  })
})

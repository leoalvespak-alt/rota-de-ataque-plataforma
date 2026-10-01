import { createHmac, timingSafeEqual } from 'node:crypto'

export const META_WEBHOOK_MAX_BODY_BYTES = 1_048_576
export const META_WEBHOOK_MAX_EVENTS = 1_000
const MAX_TEXT_CHARACTERS = 10_000

export type MetaInboxEventKind = 'comment' | 'direct_message'
export type MetaInboxContentType = 'text' | 'attachment' | 'text+attachment' | 'unknown'

export interface NormalizedMetaInboxEvent {
  channel: 'instagram'
  accountExternalId: string
  eventKind: MetaInboxEventKind
  externalEventId: string
  revisionHash: string
  senderExternalId: string | null
  mediaExternalId: string | null
  parentExternalId: string | null
  contentType: MetaInboxContentType
  textContent: string | null
  contentTruncated: boolean
  providerEventAt: string | null
  replyWindowExpiresAt: string | null
}

export class MetaWebhookBodyTooLargeError extends Error {
  constructor() {
    super('Meta webhook body exceeds the configured limit')
    this.name = 'MetaWebhookBodyTooLargeError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 512 ? normalized : null
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8')
  const rightBytes = Buffer.from(right, 'utf8')
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

export function verifyMetaWebhookSignature(rawBody: Uint8Array, signature: string | null, appSecret: string | undefined): boolean {
  if (!appSecret?.trim() || !signature || !/^sha256=[0-9a-f]{64}$/iu.test(signature)) return false
  const supplied = Buffer.from(signature.slice('sha256='.length), 'hex')
  const expected = createHmac('sha256', appSecret.trim()).update(rawBody).digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function verifyMetaWebhookChallenge(mode: string | null, suppliedToken: string | null, expectedToken: string | undefined): boolean {
  if (mode !== 'subscribe' || !suppliedToken || !expectedToken?.trim()) return false
  return constantTimeStringEqual(suppliedToken, expectedToken.trim())
}

export async function readMetaWebhookBody(request: Request, maxBytes = META_WEBHOOK_MAX_BODY_BYTES): Promise<Buffer> {
  const reader = request.body?.getReader()
  if (!reader) return Buffer.alloc(0)

  const chunks: Buffer[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new MetaWebhookBodyTooLargeError()
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, totalBytes)
  } finally {
    reader.releaseLock()
  }
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const milliseconds = value < 100_000_000_000 ? value * 1_000 : value
    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return null
}

function normalizeText(value: unknown): { text: string | null; truncated: boolean } {
  if (typeof value !== 'string' || value.length === 0) return { text: null, truncated: false }
  return value.length > MAX_TEXT_CHARACTERS
    ? { text: value.slice(0, MAX_TEXT_CHARACTERS), truncated: true }
    : { text: value, truncated: false }
}

function attachmentTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).flatMap((attachment) => {
    if (!isRecord(attachment) || typeof attachment.type !== 'string') return []
    const type = attachment.type.trim().toLowerCase()
    return /^[a-z0-9_-]{1,32}$/u.test(type) ? [type] : []
  })
}

function makeContentType(textContent: string | null, attachments: string[]): MetaInboxContentType {
  if (textContent && attachments.length > 0) return 'text+attachment'
  if (textContent) return 'text'
  if (attachments.length > 0) return 'attachment'
  return 'unknown'
}

function revisionHash(event: Omit<NormalizedMetaInboxEvent, 'revisionHash'>, secret: string): string {
  const material = JSON.stringify([
    event.channel,
    event.accountExternalId,
    event.eventKind,
    event.externalEventId,
    event.senderExternalId,
    event.mediaExternalId,
    event.parentExternalId,
    event.contentType,
    event.textContent,
    event.contentTruncated,
    event.providerEventAt,
  ])
  return createHmac('sha256', secret).update(material).digest('hex')
}

function makeEvent(
  event: Omit<NormalizedMetaInboxEvent, 'revisionHash' | 'replyWindowExpiresAt'>,
  fingerprintSecret: string,
): NormalizedMetaInboxEvent {
  const replyWindowExpiresAt = event.eventKind === 'comment' && event.providerEventAt
    ? new Date(new Date(event.providerEventAt).getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString()
    : null
  const withoutHash = { ...event, replyWindowExpiresAt }
  return { ...withoutHash, revisionHash: revisionHash(withoutHash, fingerprintSecret) }
}

export function parseMetaWebhookPayload(payload: unknown, fingerprintSecret: string): NormalizedMetaInboxEvent[] {
  if (!fingerprintSecret.trim() || !isRecord(payload) || payload.object !== 'instagram' || !Array.isArray(payload.entry)) return []
  const events: NormalizedMetaInboxEvent[] = []

  for (const rawEntry of payload.entry) {
    if (!isRecord(rawEntry)) continue
    const accountExternalId = nonEmptyId(rawEntry.id)
    if (!accountExternalId) continue

    if (Array.isArray(rawEntry.changes)) {
      for (const rawChange of rawEntry.changes) {
        if (!isRecord(rawChange) || rawChange.field !== 'comments' || !isRecord(rawChange.value)) continue
        const value = rawChange.value
        const externalEventId = nonEmptyId(value.id)
        if (!externalEventId) continue
        const senderExternalId = isRecord(value.from) ? nonEmptyId(value.from.id) : null
        if (senderExternalId === accountExternalId) continue
        const mediaExternalId = isRecord(value.media) ? nonEmptyId(value.media.id) : null
        const parentExternalId = nonEmptyId(value.parent_id)
          ?? (isRecord(value.parent) ? nonEmptyId(value.parent.id) : null)
        const normalizedText = normalizeText(value.text)
        const providerEventAt = normalizeTimestamp(value.timestamp ?? value.created_time)
        const event = makeEvent({
          channel: 'instagram',
          accountExternalId,
          eventKind: 'comment',
          externalEventId,
          senderExternalId,
          mediaExternalId,
          parentExternalId,
          contentType: normalizedText.text ? 'text' : 'unknown',
          textContent: normalizedText.text,
          contentTruncated: normalizedText.truncated,
          providerEventAt,
        }, fingerprintSecret)
        events.push(event)
      }
    }

    if (Array.isArray(rawEntry.messaging)) {
      for (const rawMessagingEvent of rawEntry.messaging) {
        if (!isRecord(rawMessagingEvent) || !isRecord(rawMessagingEvent.message)) continue
        const message = rawMessagingEvent.message
        if (message.is_echo === true) continue
        const externalEventId = nonEmptyId(message.mid)
        if (!externalEventId) continue
        const senderExternalId = isRecord(rawMessagingEvent.sender) ? nonEmptyId(rawMessagingEvent.sender.id) : null
        if (senderExternalId === accountExternalId) continue
        const normalizedText = normalizeText(message.text)
        const attachments = attachmentTypes(message.attachments)
        const event = makeEvent({
          channel: 'instagram',
          accountExternalId,
          eventKind: 'direct_message',
          externalEventId,
          senderExternalId,
          mediaExternalId: null,
          parentExternalId: null,
          contentType: makeContentType(normalizedText.text, attachments),
          textContent: normalizedText.text,
          contentTruncated: normalizedText.truncated,
          providerEventAt: normalizeTimestamp(rawMessagingEvent.timestamp),
        }, fingerprintSecret)
        events.push(event)
      }
    }
  }

  return events
}

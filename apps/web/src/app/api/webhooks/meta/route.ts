import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import {
  META_WEBHOOK_MAX_EVENTS,
  MetaWebhookBodyTooLargeError,
  parseMetaWebhookPayload,
  readMetaWebhookBody,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from '@/lib/meta-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken?.trim()) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })

  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (!challenge || !verifyMetaWebhookChallenge(mode, token, verifyToken)) {
    return NextResponse.json({ error: 'webhook_challenge_rejected' }, { status: 403 })
  }
  return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET
  const databaseUrl = process.env.DATABASE_URL
  if (!appSecret?.trim() || !databaseUrl?.trim()) {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })
  }

  let rawBody: Buffer
  try {
    rawBody = await readMetaWebhookBody(request)
  } catch (error) {
    if (error instanceof MetaWebhookBodyTooLargeError) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    return NextResponse.json({ error: 'payload_unreadable' }, { status: 400 })
  }

  if (!verifyMetaWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const events = parseMetaWebhookPayload(payload, appSecret)
  if (events.length > META_WEBHOOK_MAX_EVENTS) return NextResponse.json({ error: 'too_many_events' }, { status: 413 })
  const { pool } = createDatabase(databaseUrl)
  const connect = () => pool.connect()
  let client: Awaited<ReturnType<typeof connect>>
  try {
    client = await connect()
  } catch {
    return NextResponse.json({ error: 'webhook_persistence_unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  let insertedCount = 0
  let duplicateCount = 0

  try {
    await client.query('BEGIN')
    for (const event of events) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO editorial.social_inbox_events(
           provider,channel,account_external_id,event_kind,external_event_id,revision_hash,
           sender_external_id,media_external_id,parent_external_id,content_type,text_content,
           content_truncated,provider_event_at,reply_window_expires_at
         )
         VALUES('meta',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::timestamptz)
         ON CONFLICT(provider,channel,account_external_id,event_kind,external_event_id,revision_hash) DO NOTHING
         RETURNING id`,
        [
          event.channel,
          event.accountExternalId,
          event.eventKind,
          event.externalEventId,
          event.revisionHash,
          event.senderExternalId,
          event.mediaExternalId,
          event.parentExternalId,
          event.contentType,
          event.textContent,
          event.contentTruncated,
          event.providerEventAt,
          event.replyWindowExpiresAt,
        ],
      )
      const isNew = Boolean(inserted.rows[0])
      const eventId = inserted.rows[0]?.id ?? (await client.query<{ id: string }>(
        `SELECT id FROM editorial.social_inbox_events
         WHERE provider='meta' AND channel=$1 AND account_external_id=$2 AND event_kind=$3
           AND external_event_id=$4 AND revision_hash=$5`,
        [event.channel, event.accountExternalId, event.eventKind, event.externalEventId, event.revisionHash],
      )).rows[0]?.id
      if (!eventId) throw new Error('Persisted Meta inbox event could not be resolved')

      await client.query(
        `INSERT INTO editorial.task_runs(
           task_name,idempotency_key,payload,status,attempt,schedule_time,retry_at,
           available_at,priority,lane,max_attempts,updated_at
         )
         VALUES('inbox.message',$1,$2::jsonb,'accepted',0,NULL,NULL,now(),90,'inbound',5,now())
         ON CONFLICT(idempotency_key) DO NOTHING`,
        [`inbox.message:${eventId}`, JSON.stringify({ eventId })],
      )
      if (isNew) insertedCount++
      else duplicateCount++
    }
    await client.query('COMMIT')
    return NextResponse.json({ accepted: insertedCount, duplicates: duplicateCount }, { status: 200, headers: { 'cache-control': 'no-store' } })
  } catch {
    await client.query('ROLLBACK').catch(() => undefined)
    console.error('Meta webhook persistence failed')
    return NextResponse.json({ error: 'webhook_persistence_failed' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  } finally {
    client.release()
  }
}

import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse } from '@/lib/api-errors'

const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const ALLOWED_STATUSES = new Set(['pending_triage', 'needs_human_review', 'triaged', 'resolved', 'expired'])

interface InboxCursor {
  receivedAt: string
  id: string
}

function parseCursor(value: string | null): InboxCursor | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<InboxCursor>
    if (typeof parsed.receivedAt !== 'string' || Number.isNaN(Date.parse(parsed.receivedAt))) return null
    if (typeof parsed.id !== 'string' || !EVENT_ID_PATTERN.test(parsed.id)) return null
    return { receivedAt: new Date(parsed.receivedAt).toISOString(), id: parsed.id }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    await requireRole('operator')
    const url = new URL(request.url)
    const requestedStatus = url.searchParams.get('status')
    if (requestedStatus && !ALLOWED_STATUSES.has(requestedStatus)) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    const cursorValue = url.searchParams.get('cursor')
    const cursor = parseCursor(cursorValue)
    if (cursorValue && !cursor) return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 })
    const requestedLimit = Number(url.searchParams.get('limit') ?? '30')
    const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 30

    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const [eventsResult, countsResult] = await Promise.all([
      pool.query<{
        id: string
        channel: string
        event_kind: string
        content_type: string
        text_content: string | null
        content_truncated: boolean
        provider_event_at: Date | null
        reply_window_expires_at: Date | null
        status: string
        triage_reason: string | null
        received_at: Date
        redacted_at: Date | null
      }>(
        `SELECT id,channel,event_kind,content_type,text_content,content_truncated,provider_event_at,
                reply_window_expires_at,status,triage_reason,received_at,redacted_at
         FROM editorial.social_inbox_events
         WHERE ($1::text IS NULL OR status=$1)
           AND ($2::timestamptz IS NULL OR (received_at,id)<($2::timestamptz,$3::uuid))
         ORDER BY received_at DESC,id DESC LIMIT $4`,
        [requestedStatus, cursor?.receivedAt ?? null, cursor?.id ?? null, limit + 1],
      ),
      pool.query<{ status: string; count: number }>(
        `SELECT status,count(*)::int AS count FROM editorial.social_inbox_events GROUP BY status`,
      ),
    ])
    const hasMore = eventsResult.rows.length > limit
    const rows = hasMore ? eventsResult.rows.slice(0, limit) : eventsResult.rows
    const last = rows[rows.length - 1]
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ receivedAt: new Date(last.received_at).toISOString(), id: last.id })).toString('base64url')
      : null

    return NextResponse.json({
      events: rows.map((event) => ({
        id: event.id,
        channel: event.channel,
        eventKind: event.event_kind,
        contentType: event.content_type,
        textContent: event.text_content,
        contentTruncated: event.content_truncated,
        providerEventAt: event.provider_event_at?.toISOString() ?? null,
        replyWindowExpiresAt: event.reply_window_expires_at?.toISOString() ?? null,
        status: event.status,
        triageReason: event.triage_reason,
        receivedAt: event.received_at.toISOString(),
        redacted: Boolean(event.redacted_at),
      })),
      counts: Object.fromEntries(countsResult.rows.map(({ status, count }) => [status, count])),
      nextCursor,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

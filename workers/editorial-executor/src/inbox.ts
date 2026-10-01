import type { TaskExecutionContext, TaskHandler, TaskRequest } from '@plataforma/task-runtime'

interface InboxSqlPool {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>
  connect(): Promise<{
    query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>
    release(): void
  }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function inboxEventId(request: TaskRequest): string {
  const value = request.payload.eventId
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error('Inbox task has an invalid eventId')
  return value
}

export function createInboxMessageTaskHandler(pool: InboxSqlPool): TaskHandler {
  return async (request: TaskRequest, _context: TaskExecutionContext) => {
    const eventId = inboxEventId(request)
    const updated = await pool.query<{ id: string }>(
      `UPDATE editorial.social_inbox_events
       SET status='needs_human_review', triage_reason='jev_credential_pending', processed_at=now(), updated_at=now()
       WHERE id=$1::uuid AND status='pending_triage'
       RETURNING id`,
      [eventId],
    )
    if (updated.rows[0]) {
      return { result: { eventId, status: 'needs_human_review', reason: 'jev_credential_pending' } }
    }

    const existing = await pool.query<{ status: string }>(
      `SELECT status FROM editorial.social_inbox_events WHERE id=$1::uuid`,
      [eventId],
    )
    if (!existing.rows[0]) throw new Error(`Inbox event ${eventId} no longer exists`)
    return { result: { eventId, status: existing.rows[0].status, idempotent: true } }
  }
}

export function createInboxRetentionCleanupTaskHandler(pool: InboxSqlPool): TaskHandler {
  return async (_request: TaskRequest, _context: TaskExecutionContext) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const redacted = await client.query<{ id: string }>(
        `WITH candidates AS (
           SELECT id FROM editorial.social_inbox_events
           WHERE personal_data_expires_at <= now() AND redacted_at IS NULL
           ORDER BY personal_data_expires_at,id
           FOR UPDATE SKIP LOCKED LIMIT 500
         )
         UPDATE editorial.social_inbox_events event
         SET text_content=NULL, sender_external_id=NULL, media_external_id=NULL, parent_external_id=NULL,
             content_type='unknown', content_truncated=false, redacted_at=now(), updated_at=now(),
             status=CASE WHEN event.status IN ('pending_triage','needs_human_review') THEN 'expired' ELSE event.status END,
             triage_reason=CASE WHEN event.status IN ('pending_triage','needs_human_review') THEN 'personal_data_retention_expired' ELSE event.triage_reason END
         FROM candidates WHERE event.id=candidates.id
         RETURNING event.id`,
      )
      const deleted = await client.query<{ id: string }>(
        `WITH candidates AS (
           SELECT id FROM editorial.social_inbox_events
           WHERE dedupe_expires_at <= now() AND redacted_at IS NOT NULL
           ORDER BY dedupe_expires_at,id
           FOR UPDATE SKIP LOCKED LIMIT 500
         )
         DELETE FROM editorial.social_inbox_events event
         USING candidates WHERE event.id=candidates.id
         RETURNING event.id`,
      )
      await client.query('COMMIT')
      return { result: { redacted: redacted.rows.length, deleted: deleted.rows.length } }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}

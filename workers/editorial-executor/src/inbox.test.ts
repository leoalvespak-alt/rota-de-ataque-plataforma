import { describe, expect, it, vi } from 'vitest'
import { makeTaskRequest, type TaskExecutionContext } from '@plataforma/task-runtime'
import { createInboxMessageTaskHandler, createInboxRetentionCleanupTaskHandler } from './inbox.js'

const eventId = '550e8400-e29b-41d4-a716-446655440000'
const context: TaskExecutionContext = {
  runId: 'run-1',
  attempt: 1,
  checkpoint: null,
  signal: new AbortController().signal,
  saveCheckpoint: async () => undefined,
}

describe('editorial inbox task handlers', () => {
  it('routes events to human review while the JEV credential is pending', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: eventId }], rowCount: 1 })
    const handler = createInboxMessageTaskHandler({ query } as never)
    const result = await handler(makeTaskRequest('inbox.message', { eventId }, { occurrenceKey: eventId }), context)

    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='needs_human_review'"), [eventId])
    expect(query).toHaveBeenCalledWith(expect.stringContaining("triage_reason='jev_credential_pending'"), [eventId])
    expect(result.result).toMatchObject({ eventId, status: 'needs_human_review', reason: 'jev_credential_pending' })
  })

  it('keeps an already processed inbox status on task replay', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ status: 'resolved' }], rowCount: 1 })
    const handler = createInboxMessageTaskHandler({ query } as never)
    const result = await handler(makeTaskRequest('inbox.message', { eventId }, { occurrenceKey: eventId }), context)

    expect(result.result).toMatchObject({ eventId, status: 'resolved', idempotent: true })
  })

  it('redacts expired text and later removes dedup records in bounded batches', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [{ id: 'c' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
    const release = vi.fn()
    const handler = createInboxRetentionCleanupTaskHandler({
      query: vi.fn(),
      connect: async () => ({ query: clientQuery, release }),
    } as never)
    const result = await handler(makeTaskRequest('inbox.retention.cleanup', {}, { occurrenceKey: 'manual-cleanup-1' }), context)

    expect(clientQuery.mock.calls[1]?.[0]).toContain('text_content=NULL')
    expect(clientQuery.mock.calls[1]?.[0]).toContain('personal_data_expires_at <= now()')
    expect(clientQuery.mock.calls[2]?.[0]).toContain('dedupe_expires_at <= now()')
    expect(clientQuery.mock.calls[1]?.[0]).toContain('LIMIT 500')
    expect(clientQuery.mock.calls[2]?.[0]).toContain('LIMIT 500')
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', expect.any(String), expect.any(String), 'COMMIT'])
    expect(result.result).toEqual({ redacted: 2, deleted: 1 })
    expect(release).toHaveBeenCalledOnce()
  })
})

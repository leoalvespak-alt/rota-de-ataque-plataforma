import { describe, expect, it, vi } from 'vitest'
import { makeTaskRequest, type TaskExecutionContext } from '@plataforma/task-runtime'
import { createPublicationDueTaskHandler } from './publication.js'

const context: TaskExecutionContext = {
  runId: 'run-pub-1',
  attempt: 1,
  checkpoint: null,
  signal: new AbortController().signal,
  saveCheckpoint: async () => undefined,
}

const scheduledRow = {
  id: 'pub-1',
  channel: 'instagram',
  caption: 'Legenda',
  title: 'Titulo',
  status: 'scheduled',
  approved_by: 'auto-jev-gate',
  scheduled_for: new Date().toISOString(),
  image_url: 'https://cdn.example/cover.png',
}

function request(extra: Record<string, unknown> = {}) {
  return makeTaskRequest('publication.due', { publicationId: 'pub-1', ...extra }, {
    scheduleTime: new Date().toISOString(),
    accountId: '10000000-0000-4000-8000-000000000001',
    itemId: '20000000-0000-4000-8000-000000000001',
    revisionId: '30000000-0000-4000-8000-000000000001',
  })
}

describe('publication.due task handler', () => {
  it('publishes approved rows and records the receipt', async () => {
    const publisher = {
      publish: vi.fn().mockResolvedValue({ channel: 'instagram', status: 'published', externalId: 'media-1', error: null, attempts: 2 }),
    }
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [scheduledRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const handler = createPublicationDueTaskHandler({ query } as never, { publisher: publisher as never })
    const result = await handler(request(), context)

    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'instagram', caption: 'Legenda', approvedBy: 'auto-jev-gate',
    }))
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='published'"), expect.anything())
    expect(query).toHaveBeenCalledWith(expect.stringContaining('publication.published'), expect.anything())
    expect(result.result).toMatchObject({ ok: true, mediaId: 'media-1' })
    expect(result.events?.[0]).toMatchObject({ eventType: 'publication.published' })
  })

  it('is idempotent for already published rows', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ ...scheduledRow, status: 'published' }], rowCount: 1 })
    const handler = createPublicationDueTaskHandler({ query } as never, { publisher: null })
    const result = await handler(request(), context)
    expect(result.result).toMatchObject({ ok: true, alreadyPublished: true })
  })

  it('refuses rows without approval and fails closed on Meta errors', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ ...scheduledRow, approved_by: '  ' }], rowCount: 1 })
    const handler = createPublicationDueTaskHandler({ query } as never, { publisher: null })
    await expect(handler(request(), context)).rejects.toThrow('needs approval')

    const failing = { publish: vi.fn().mockResolvedValue({ channel: 'instagram', status: 'failed', externalId: null, error: 'bad', attempts: 1 }) }
    const query2 = vi.fn()
      .mockResolvedValueOnce({ rows: [scheduledRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const handler2 = createPublicationDueTaskHandler({ query: query2 } as never, { publisher: failing as never })
    await expect(handler2(request(), context)).rejects.toThrow('Meta publish failed')
  })

  it('rejects reposts of already posted pautas', async () => {
    const failing = { publish: vi.fn() }
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [scheduledRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ fingerprint: 'fp-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'pauta-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const handler = createPublicationDueTaskHandler({ query } as never, { publisher: failing as never })
    const result = await handler(request(), context)
    expect(failing.publish).not.toHaveBeenCalled()
    expect(result.result).toMatchObject({ ok: true, duplicateOfPosted: true })
  })
})

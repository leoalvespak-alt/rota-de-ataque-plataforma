import { makeWorkerJob, validWorkerPreflight } from '@plataforma/shared/worker'
import { describe, expect, it, vi } from 'vitest'
import { createThreadsPublisher, spec, type NotificationSink, type PublishableThreadsVariant, type ThreadsPublishClient, type ThreadsPublisherRepository } from './index.js'

const row = (overrides: Partial<PublishableThreadsVariant> = {}): PublishableThreadsVariant => ({
  id: 'variant-1',
  publicationId: 'publication-1',
  userId: 'threads-user-1',
  text: 'post',
  status: 'approved',
  approvedBy: 'operator@test.com',
  rateUsed24h: 10,
  origin: 'manual',
  ...overrides,
})

const makeRepo = (rows: PublishableThreadsVariant[] = []): ThreadsPublisherRepository => ({
  due: vi.fn().mockResolvedValue(rows),
  complete: vi.fn().mockResolvedValue(undefined),
  fail: vi.fn().mockResolvedValue(undefined),
  scheduleMetricsCollection: vi.fn().mockResolvedValue(undefined),
})

const makeNotifications = (): NotificationSink => ({
  notify: vi.fn().mockResolvedValue(undefined),
})

const makeClient = (): ThreadsPublishClient => ({
  createContainer: vi.fn().mockResolvedValue({ id: 'container-1' }),
  publishContainer: vi.fn().mockResolvedValue({ id: 'published-1' }),
})

describe('threads-publisher', () => {
  it('declares its worker contract', () => {
    expect(spec.queue).toBe('threads-publisher')
    expect(spec.outbound).toBe(true)
  })

  it('skips ai_generated without approval and notifies', async () => {
    const repo = makeRepo([row({ origin: 'ai_generated', approvedBy: undefined })])
    const notifications = makeNotifications()
    const publisher = createThreadsPublisher(repo, makeClient, notifications)

    await publisher(makeWorkerJob({}))

    expect(notifications.notify).toHaveBeenCalledWith('publication.needs_approval', expect.objectContaining({ publicationId: 'publication-1' }))
    expect(repo.complete).not.toHaveBeenCalled()
  })

  it('skips when rate limited', async () => {
    const repo = makeRepo([row({ rateUsed24h: 250 })])
    const notifications = makeNotifications()
    const publisher = createThreadsPublisher(repo, makeClient, notifications)

    await publisher(makeWorkerJob({}))

    expect(notifications.notify).toHaveBeenCalledWith('publication.rate_limited', expect.any(Object))
    expect(repo.complete).not.toHaveBeenCalled()
  })

  it('publishes manual approved content and schedules metrics', async () => {
    const repo = makeRepo([row()])
    const client = makeClient()
    const publisher = createThreadsPublisher(repo, () => client, makeNotifications())

    const result = await publisher(makeWorkerJob({}, { attemptsMade: 1 }))

    expect(client.createContainer).toHaveBeenCalledWith('threads-user-1', 'post')
    expect(repo.complete).toHaveBeenCalledWith(expect.objectContaining({ id: 'variant-1' }), 'published-1', expect.any(String))
    expect(repo.scheduleMetricsCollection).toHaveBeenCalledWith('publication-1', 'published-1')
    expect(result.event?.payload).toEqual({ channel: 'threads', published: 1 })
  })

  it('blocks stale migrations and account kill-switch before external calls', async () => {
    const repo = makeRepo([row()])
    const client = makeClient()
    const publisher = createThreadsPublisher(repo, () => client, makeNotifications())

    await expect(publisher(makeWorkerJob({}, { preflight: { ...validWorkerPreflight, migrationsCurrent: false } }))).rejects.toMatchObject({ reasonCode: 'PREFLIGHT_FAILED' })
    await expect(publisher(makeWorkerJob({}, { preflight: { ...validWorkerPreflight, accountStatus: 'STOPPED' } }))).rejects.toMatchObject({ reasonCode: 'PREFLIGHT_FAILED' })
    expect(repo.due).not.toHaveBeenCalled()
    expect(client.createContainer).not.toHaveBeenCalled()
  })

  it('rejects an invalid payload before repository access', async () => {
    const repo = makeRepo([row()])
    const publisher = createThreadsPublisher(repo, makeClient, makeNotifications())
    const invalidJob = makeWorkerJob({ publicationId: 42 } as unknown as { publicationId?: string })

    await expect(publisher(invalidJob)).rejects.toMatchObject({ reasonCode: 'PREFLIGHT_FAILED' })
    expect(repo.due).not.toHaveBeenCalled()
  })

  it('records a permanent Threads failure with the worker trace', async () => {
    const repo = makeRepo([row()])
    const client = makeClient()
    vi.mocked(client.createContainer).mockRejectedValueOnce(new Error('threads unavailable'))
    const publisher = createThreadsPublisher(repo, () => client, makeNotifications())

    await expect(publisher(makeWorkerJob({}))).rejects.toThrow('threads unavailable')
    expect(repo.fail).toHaveBeenCalledWith('publication-1', 'threads unavailable', expect.any(String))
  })
})

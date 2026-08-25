import { makeWorkerJob, validWorkerPreflight } from '@plataforma/shared/worker'
import { describe, expect, it, vi } from 'vitest'
import { createPublisherProcessor, spec, type NotificationSink, type PublisherMetaClient, type PublisherRepository, type PublicAssetStore, type ScheduledPublication } from './index.js'

const row = (overrides: Partial<ScheduledPublication> = {}): ScheduledPublication => ({
  id: 'publication-1',
  variantId: 'variant-1',
  accountId: 'account-1',
  role: 'actor',
  status: 'approved',
  approvedBy: 'operator@test.com',
  igUserId: 'ig-user-1',
  caption: 'caption',
  key: 'asset-key',
  png: new Uint8Array(),
  origin: 'manual',
  channel: 'instagram',
  ...overrides,
})

const makeRepo = (rows: ScheduledPublication[] = []): PublisherRepository => ({
  due: vi.fn().mockResolvedValue(rows),
  complete: vi.fn().mockResolvedValue(undefined),
  fail: vi.fn().mockResolvedValue(undefined),
  markAwaitingManualPublish: vi.fn().mockResolvedValue(undefined),
  scheduleMetricsCollection: vi.fn().mockResolvedValue(undefined),
})

const makeStore = (): PublicAssetStore => ({
  uploadPng: vi.fn().mockResolvedValue({ publicUrl: 'https://cdn/img.png', storageRef: 'ref' }),
})

const makeNotifications = (): NotificationSink => ({
  notify: vi.fn().mockResolvedValue(undefined),
})

const makeMeta = (): PublisherMetaClient => ({
  publishing: {
    create: vi.fn().mockResolvedValue({ id: 'container-1' }),
    publish: vi.fn().mockResolvedValue({ id: 'media-1' }),
  },
})

describe('publisher', () => {
  it('declares its worker contract', () => {
    expect(spec.queue).toBe('publisher')
    expect(spec.outbound).toBe(true)
    expect(spec.requiredRole).toBe('actor')
  })

  it('skips ai_generated items without approval and notifies', async () => {
    const repo = makeRepo([row({ id: 'publication-ai', approvedBy: undefined, origin: 'ai_generated' })])
    const notifications = makeNotifications()
    const processor = createPublisherProcessor(repo, makeStore(), null, notifications)

    const result = await processor(makeWorkerJob({}))

    expect(notifications.notify).toHaveBeenCalledWith('publication.needs_approval', expect.objectContaining({ publicationId: 'publication-ai' }))
    expect(repo.complete).not.toHaveBeenCalled()
    expect(result.event?.payload).toEqual({ published: 0, fallbacks: 0 })
  })

  it('creates fallback package when Meta API is null', async () => {
    const repo = makeRepo([row({ id: 'publication-fallback' })])
    const store = makeStore()
    const notifications = makeNotifications()
    const processor = createPublisherProcessor(repo, store, null, notifications)

    const result = await processor(makeWorkerJob({}))

    expect(repo.markAwaitingManualPublish).toHaveBeenCalledWith('publication-fallback', expect.objectContaining({ publicationId: 'publication-fallback' }), expect.any(String))
    expect(notifications.notify).toHaveBeenCalledWith('publication.manual_required', expect.any(Object))
    expect(result.event?.payload).toEqual({ published: 0, fallbacks: 1 })
  })

  it('publishes manual items with approval directly', async () => {
    const repo = makeRepo([row({ id: 'publication-live' })])
    const meta = makeMeta()
    const processor = createPublisherProcessor(repo, makeStore(), meta, makeNotifications())

    const result = await processor(makeWorkerJob({}, { attemptsMade: 1 }))

    expect(meta.publishing.create).toHaveBeenCalled()
    expect(repo.complete).toHaveBeenCalledWith('publication-live', 'variant-1', 'media-1', 'ref', expect.any(String))
    expect(repo.scheduleMetricsCollection).toHaveBeenCalledWith('publication-live', 'media-1')
    expect(result.event?.payload).toEqual({ published: 1, fallbacks: 0 })
  })

  it('blocks stale migrations before repository access', async () => {
    const repo = makeRepo([row()])
    const processor = createPublisherProcessor(repo, makeStore(), makeMeta(), makeNotifications())

    await expect(processor(makeWorkerJob({}, { preflight: { ...validWorkerPreflight, migrationsCurrent: false } }))).rejects.toMatchObject({ reasonCode: 'MIGRATION_DRIFT' })
    expect(repo.due).not.toHaveBeenCalled()
  })

  it('blocks the publishing kill-switch before external calls', async () => {
    const repo = makeRepo([row()])
    const processor = createPublisherProcessor(repo, makeStore(), makeMeta(), makeNotifications())

    await expect(processor(makeWorkerJob({}, { preflight: { ...validWorkerPreflight, accountStatus: 'STOPPED' } }))).rejects.toMatchObject({ reasonCode: 'ACCOUNT_AUTH_REQUIRED' })
    expect(repo.due).not.toHaveBeenCalled()
  })

  it('rejects an invalid payload before repository access', async () => {
    const repo = makeRepo([row()])
    const processor = createPublisherProcessor(repo, makeStore(), makeMeta(), makeNotifications())
    const invalidJob = makeWorkerJob({ publicationId: 42 } as unknown as { publicationId?: string })

    await expect(processor(invalidJob)).rejects.toMatchObject({ reasonCode: 'PREFLIGHT_FAILED' })
    expect(repo.due).not.toHaveBeenCalled()
  })

  it('records a permanent publication failure with the worker trace', async () => {
    const repo = makeRepo([row()])
    const store = makeStore()
    vi.mocked(store.uploadPng).mockRejectedValueOnce(new Error('storage unavailable'))
    const processor = createPublisherProcessor(repo, store, makeMeta(), makeNotifications())

    await expect(processor(makeWorkerJob({}))).rejects.toThrow('storage unavailable')
    expect(repo.fail).toHaveBeenCalledWith('publication-1', 'Error: storage unavailable', expect.any(String))
  })
})

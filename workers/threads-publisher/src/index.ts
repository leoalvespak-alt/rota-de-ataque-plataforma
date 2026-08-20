import { assertHumanApproval } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'threads-publisher', requiredRole: 'actor', outbound: true } satisfies WorkerSpec
export interface ThreadsPublishPayload { variantId?: string; publicationId?: string; approvedBy?: string; synthetic?: boolean }
export interface PublishableThreadsVariant {
  id: string
  publicationId: string
  userId: string
  text: string
  status: string
  approvedBy?: string
  rateUsed24h: number
  origin: 'manual' | 'ai_generated' | 'automation'
}

export interface ThreadsPublisherRepository {
  due(payload: ThreadsPublishPayload): Promise<PublishableThreadsVariant[]>
  complete(row: PublishableThreadsVariant, externalId: string, traceId: string): Promise<void>
  fail(publicationId: string, error: string, traceId: string): Promise<void>
  scheduleMetricsCollection(publicationId: string, externalId: string): Promise<void>
}

export interface NotificationSink {
  notify(type: string, payload: Record<string, unknown>): Promise<void>
}

export interface ThreadsPublishClient {
  createContainer(userId: string, text: string): Promise<{ id: string }>
  publishContainer(userId: string, creationId: string): Promise<{ id: string }>
}

export function assertThreadsPublishPayload(payload: ThreadsPublishPayload) {
  if (
    (payload.variantId !== undefined && typeof payload.variantId !== 'string') ||
    (payload.publicationId !== undefined && typeof payload.publicationId !== 'string') ||
    (payload.approvedBy !== undefined && typeof payload.approvedBy !== 'string') ||
    (payload.synthetic !== undefined && typeof payload.synthetic !== 'boolean')
  ) throw Object.assign(new Error('Invalid Threads publisher payload'), { reasonCode: 'PREFLIGHT_FAILED' as const })
}

export function createThreadsPublisher(
  repository: ThreadsPublisherRepository,
  clientFor: (row: PublishableThreadsVariant) => ThreadsPublishClient,
  notifications: NotificationSink,
) {
  const gate = createWorker<ThreadsPublishPayload>(spec)
  return async (job: WorkerJob<ThreadsPublishPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    assertThreadsPublishPayload(job.payload)
    const rows = await repository.due(job.payload)
    let published = 0

    for (const row of rows) {
      if (row.origin === 'ai_generated' && !row.approvedBy && !job.payload.approvedBy) {
        await notifications.notify('publication.needs_approval', { publicationId: row.publicationId, channel: 'threads', text: row.text.slice(0, 200) })
        continue
      }

      if (row.rateUsed24h >= 250) {
        await notifications.notify('publication.rate_limited', { publicationId: row.publicationId, channel: 'threads', rateUsed: row.rateUsed24h })
        continue
      }

      const effectiveApproval = row.approvedBy ?? job.payload.approvedBy
      assertHumanApproval({ status: row.status, approvedBy: effectiveApproval })

      try {
        const client = clientFor(row)
        const container = await client.createContainer(row.userId, row.text)
        const result = await client.publishContainer(row.userId, container.id)
        await repository.complete(row, result.id, base.traceId)
        await repository.scheduleMetricsCollection(row.publicationId, result.id)
        published += 1
      } catch (error) {
        await repository.fail(row.publicationId, error instanceof Error ? error.message : 'THREADS_PUBLICATION_FAILED', base.traceId)
        throw error
      }
    }

    return { ...base, event: { kind: 'content.published', payload: { channel: 'threads', published } } }
  }
}

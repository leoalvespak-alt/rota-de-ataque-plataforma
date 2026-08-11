import { ThreadsClient } from '@plataforma/threads-api'
import { assertHumanApproval } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'threads-publisher', requiredRole: 'actor', outbound: true } satisfies WorkerSpec
export interface ThreadsPublishPayload { variantId: string; approvedBy?: string }
export interface PublishableThreadsVariant { id: string; userId: string; text: string; status: string; rateUsed24h: number }
export interface ThreadsPublisherRepository { get(id: string): Promise<PublishableThreadsVariant | null>; complete(variantId: string, externalId: string, traceId: string): Promise<void> }
export function createThreadsPublisher(repository: ThreadsPublisherRepository, clientFor: (row: PublishableThreadsVariant) => ThreadsClient) {
  const gate = createWorker<ThreadsPublishPayload>(spec)
  return async (job: WorkerJob<ThreadsPublishPayload>): Promise<WorkerResult> => {
    const base = await gate(job); const row = await repository.get(job.payload.variantId)
    if (!row || row.status !== 'approved' || row.rateUsed24h >= 250) throw Object.assign(new Error('Threads publication preflight failed'), { reasonCode: 'PREFLIGHT_FAILED' })
    assertHumanApproval({ status: row.status, approvedBy: job.payload.approvedBy })
    const client = clientFor(row); const container = await client.createContainer(row.userId, row.text); const published = await client.publishContainer(row.userId, container.id)
    await repository.complete(row.id, published.id, base.traceId)
    return { ...base, event: { kind: 'content.published', payload: { channel: 'threads', variantId: row.id, externalId: published.id } } }
  }
}

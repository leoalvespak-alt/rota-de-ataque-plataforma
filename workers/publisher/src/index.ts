import { assertExternalAllowed, assertHumanApproval, assertRole } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'publisher', requiredRole: 'actor', outbound: true } satisfies WorkerSpec

export interface PublicAssetStore {
  uploadPng(key: string, png: Uint8Array): Promise<{ publicUrl: string; storageRef: string }>
}

export interface PublisherPayload { publicationId?: string; accountId?: string; synthetic?: boolean }

export interface ScheduledPublication {
  id: string
  variantId?: string
  accountId: string
  role: 'collector' | 'actor'
  status: string
  approvedBy?: string
  igUserId: string
  caption: string
  key: string
  png: Uint8Array
  origin: 'manual' | 'ai_generated' | 'automation'
  channel: string
  hashtags?: string
  cta?: string
}

export interface FallbackPackage {
  publicationId: string
  caption: string
  hashtags?: string
  cta?: string
  assetUrl: string
  storageRef: string
}

export interface PublisherRepository {
  due(payload: PublisherPayload): Promise<ScheduledPublication[]>
  complete(id: string, variantId: string | undefined, igMediaId: string, storageRef: string, traceId: string): Promise<void>
  fail(id: string, error: string, traceId: string): Promise<void>
  markAwaitingManualPublish(id: string, fallback: FallbackPackage, traceId: string): Promise<void>
  scheduleMetricsCollection(id: string, externalId: string): Promise<void>
}

export interface NotificationSink {
  notify(type: string, payload: Record<string, unknown>): Promise<void>
}

export interface PublisherMetaClient {
  publishing: {
    create(igUserId: string, imageUrl: string, caption?: string): Promise<{ id: string }>
    publish(igUserId: string, creationId: string): Promise<{ id: string }>
  }
}

export function assertPublisherPayload(payload: PublisherPayload) {
  if (
    (payload.publicationId !== undefined && typeof payload.publicationId !== 'string') ||
    (payload.accountId !== undefined && typeof payload.accountId !== 'string') ||
    (payload.synthetic !== undefined && typeof payload.synthetic !== 'boolean')
  ) throw Object.assign(new Error('Invalid publisher payload'), { reasonCode: 'PREFLIGHT_FAILED' as const })
}

export async function publishScheduled(
  input: { role: 'collector' | 'actor'; status: string; approvedBy?: string; synthetic: boolean; igUserId: string; caption: string; key: string; png: Uint8Array },
  store: PublicAssetStore,
  meta: PublisherMetaClient,
) {
  assertRole(input.role, 'publish')
  assertHumanApproval(input)
  assertExternalAllowed(input.synthetic)
  const asset = await store.uploadPng(input.key, input.png)
  const container = await meta.publishing.create(input.igUserId, asset.publicUrl, input.caption)
  const published = await meta.publishing.publish(input.igUserId, container.id)
  return { ...asset, igMediaId: published.id }
}

export function createPublisherProcessor(
  repository: PublisherRepository,
  store: PublicAssetStore,
  meta: PublisherMetaClient | null,
  notifications: NotificationSink,
) {
  const gate = createWorker<PublisherPayload>(spec)

  return async (job: WorkerJob<PublisherPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    assertPublisherPayload(job.payload)
    const rows = await repository.due(job.payload)
    let published = 0
    let fallbacks = 0

    for (const row of rows) {
      if (row.origin === 'ai_generated' && !row.approvedBy) {
        await notifications.notify('publication.needs_approval', { publicationId: row.id, caption: row.caption })
        continue
      }

      try {
        if (row.channel === 'instagram') {
          if (!meta) {
            const asset = await store.uploadPng(`ready/${row.id}.png`, row.png)
            const fallback: FallbackPackage = {
              publicationId: row.id,
              caption: row.caption,
              hashtags: row.hashtags,
              cta: row.cta,
              assetUrl: asset.publicUrl,
              storageRef: asset.storageRef,
            }
            await repository.markAwaitingManualPublish(row.id, fallback, base.traceId)
            await notifications.notify('publication.manual_required', { ...fallback })
            fallbacks++
            continue
          }

          const result = await publishScheduled(
            { role: row.role, status: row.status, approvedBy: row.approvedBy, synthetic: Boolean(job.payload.synthetic), igUserId: row.igUserId, caption: row.caption, key: row.key, png: row.png },
            store,
            meta,
          )
          await repository.complete(row.id, row.variantId, result.igMediaId, result.storageRef, base.traceId)
          await repository.scheduleMetricsCollection(row.id, result.igMediaId)
          published++
        }
      } catch (error) {
        await repository.fail(row.id, String(error), base.traceId)
        throw error
      }
    }

    return { ...base, event: { kind: 'publisher.completed', payload: { published, fallbacks } } }
  }
}

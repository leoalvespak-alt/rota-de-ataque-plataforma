import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'
import { variantJobId } from '@plataforma/queue'

export const spec = { queue: 'content-item-orchestrator', requiresMetaToken: false } satisfies WorkerSpec
export interface ContentItemPayload { contentItemId: string; channels?: Array<'instagram' | 'threads' | 'email' | 'whatsapp_dm' | 'whatsapp_group'> }
export interface ContentItem { id: string; frozenAt: Date | null; parentId: string | null; brandVoiceVersion: string; campaignActive: boolean; actorHealthy: boolean }
export interface ContentItemRepository { get(id: string): Promise<ContentItem | null> }
export interface VariantEnqueuer { enqueue(queue: 'threads-adapter' | 'email-flow-engine' | 'whatsapp-outbound' | 'whatsapp-group-manager' | 'publisher', jobId: string, payload: Record<string, unknown>): Promise<void> }

const queueFor = { instagram: 'publisher', threads: 'threads-adapter', email: 'email-flow-engine', whatsapp_dm: 'whatsapp-outbound', whatsapp_group: 'whatsapp-group-manager' } as const
export function createContentItemOrchestrator(repository: ContentItemRepository, enqueuer: VariantEnqueuer) {
  const gate = createWorker<ContentItemPayload>(spec)
  return async (job: WorkerJob<ContentItemPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const item = await repository.get(job.payload.contentItemId)
    if (!item || item.frozenAt || !item.brandVoiceVersion || !item.campaignActive || !item.actorHealthy) throw Object.assign(new Error('Content item orchestration preflight failed'), { reasonCode: 'PREFLIGHT_FAILED' })
    const channels = job.payload.channels ?? ['instagram', 'threads']
    await Promise.all(channels.map(async (channel) => enqueuer.enqueue(queueFor[channel], variantJobId(item.id, channel), { contentItemId: item.id, channel })))
    return { ...base, event: { kind: 'content-item.orchestrated', payload: { contentItemId: item.id, channels } } }
  }
}

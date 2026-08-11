import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'
export const spec = { queue: 'meta-webhook-consumer', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface WebhookPayload { entry?: Array<{ id?: string; time?: number; changes?: Array<{ field?: string; value?: Record<string, unknown> }>; messaging?: Array<Record<string, unknown>> }> }
export interface WebhookRepository { message(accountIgId: string, event: Record<string, unknown>): Promise<{ eventId: string; messageId: string; threadId: string; leadId: string; campaignId: string; subsequent: boolean } | null>; mention(accountIgId: string, value: Record<string, unknown>): Promise<{ eventId: string; mentionId: string } | null>; comment(accountIgId: string, value: Record<string, unknown>): Promise<{ eventId: string; commentId: string; leadId: string; campaignId: string } | null> }
export interface WebhookQueue { dm(payload: Record<string, unknown>, eventId: string): Promise<void>; conversation(payload: Record<string, unknown>, eventId: string): Promise<void>; mention(payload: Record<string, unknown>, eventId: string): Promise<void>; classification(payload: Record<string, unknown>, eventId: string): Promise<void> }
export function createWebhookProcessor(repository: WebhookRepository, queue: WebhookQueue) {
  const gate = createWorker<WebhookPayload>(spec)
  return async (job: WorkerJob<WebhookPayload>): Promise<WorkerResult> => {
    const base = await gate(job); let routed = 0
    for (const entry of job.payload.entry ?? []) {
      const accountIgId = entry.id ?? ''
      for (const event of entry.messaging ?? []) {
        const saved = await repository.message(accountIgId, event)
        if (saved) {
          const payload = { triggerKind: 'inbound', inboundAt: new Date(Number(entry.time ?? Date.now()) * 1000).toISOString(), ...saved }
          if (saved.subsequent) await queue.conversation(payload, saved.eventId); else await queue.dm(payload, saved.eventId)
          routed++
        }
      }
      for (const change of entry.changes ?? []) {
        if (change.field === 'mentions') { const saved = await repository.mention(accountIgId, change.value ?? {}); if (saved) { await queue.mention(saved, saved.eventId); routed++ } }
        else if (change.field === 'comments') { const saved = await repository.comment(accountIgId, change.value ?? {}); if (saved) { await queue.classification({ scope: 'own', ...saved }, saved.eventId); routed++ } }
      }
    }
    return { ...base, event: { kind: 'meta-webhook.routed', payload: { routed } } }
  }
}

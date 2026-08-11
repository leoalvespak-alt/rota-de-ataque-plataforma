import { parseContentVariantPayload } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'threads-adapter', requiresMetaToken: false } satisfies WorkerSpec
export interface ThreadsAdapterPayload { contentItemId: string }
export interface ThreadsItem { id: string; campaignId: string; angle: string; hook: string; arguments: unknown; brandVoiceVersion: string }
export interface ThreadsAdapterRepository { get(id: string): Promise<ThreadsItem | null>; recentTexts(campaignId: string): Promise<string[]>; save(itemId: string, text: string): Promise<string>; createReview(variantId: string, traceId: string, violations?: string[]): Promise<void> }
export type ThreadsGenerator = (prompt: string, recent: string[]) => Promise<string>
export type ThreadsHumanizer = (item: ThreadsItem, recent: string[]) => Promise<{ text: string; ok: boolean; violations: string[] }>

export function threadsPrompt(item: ThreadsItem) { return `Formule este raciocínio como post Threads standalone, até 500 caracteres, sem soar como legenda de Instagram e com quebras de linha estratégicas. Hook: ${item.hook}. Ângulo: ${item.angle}. Argumentos: ${JSON.stringify(item.arguments)}. Voz: ${item.brandVoiceVersion}` }

export function createThreadsAdapter(repository: ThreadsAdapterRepository, generate: ThreadsGenerator, humanize?: ThreadsHumanizer) {
  const gate = createWorker<ThreadsAdapterPayload>(spec)
  return async (job: WorkerJob<ThreadsAdapterPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const item = await repository.get(job.payload.contentItemId)
    if (!item) throw Object.assign(new Error('Content item not found'), { reasonCode: 'PREFLIGHT_FAILED' })
    const recent = await repository.recentTexts(item.campaignId)
    const result = humanize ? await humanize(item, recent) : { text: (await generate(threadsPrompt(item), recent)).trim(), ok: true, violations: [] }
    parseContentVariantPayload('threads', 'text', { text: result.text })
    const variantId = await repository.save(item.id, result.text)
    await repository.createReview(variantId, base.traceId, result.violations)
    return { ...base, event: { kind: 'threads.variant_ready', payload: { contentItemId: item.id, variantId, requiresRevision: !result.ok } } }
  }
}

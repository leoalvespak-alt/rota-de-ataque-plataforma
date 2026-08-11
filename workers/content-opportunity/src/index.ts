import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'content-opportunity', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface ContentOpportunityPayload { campaignId: string; limit?: number }
export interface ContentSignal { topic: string; painPoint?: string; question?: string; momentum: number; evidence: Record<string, unknown> }
export interface ContentOpportunityRepository { signals(payload: ContentOpportunityPayload): Promise<ContentSignal[]>; save(payload: ContentOpportunityPayload, signal: ContentSignal): Promise<void> }

export const createContentOpportunity = (signal: ContentSignal) => ({
  thesis: `${signal.topic}: conteúdo que resolve a dor percebida`,
  angle: signal.painPoint ?? `Tendência em crescimento: ${signal.topic}`,
  hook: signal.question ?? `O que ninguém está te contando sobre ${signal.topic}?`,
  evidence: signal.evidence,
  score: Math.max(0, Math.min(100, signal.momentum)),
})

export function createContentOpportunityProcessor(repository: ContentOpportunityRepository) {
  const gate = createWorker<ContentOpportunityPayload>(spec)
  return async (job: WorkerJob<ContentOpportunityPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const signals = await repository.signals(job.payload)
    for (const signal of signals) await repository.save(job.payload, signal)
    return { ...base, event: { kind: 'content-opportunity.completed', payload: { created: signals.length } } }
  }
}

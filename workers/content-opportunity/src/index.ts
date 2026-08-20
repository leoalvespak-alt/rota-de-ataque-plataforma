import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'
import { opportunityScore } from '@plataforma/organic-intelligence'

export const spec = { queue: 'content-opportunity', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface ContentOpportunityPayload { campaignId: string; limit?: number }
export interface ContentSignal { topic: string; painPoint?: string; question?: string; momentum: number; evidence: Record<string, unknown> }
export interface ContentOpportunityRepository { signals(payload: ContentOpportunityPayload): Promise<ContentSignal[]>; save(payload: ContentOpportunityPayload, signal: ContentSignal): Promise<void> }

export const createContentOpportunity = (signal: ContentSignal) => {
  const normalizedMomentum = Math.max(0, Math.min(1, signal.momentum / 100))
  const score = opportunityScore({
    relativePerformance: normalizedMomentum, recurrence: normalizedMomentum, growth: normalizedMomentum,
    audiencePain: signal.painPoint ? .8 : .3, utility: signal.question ? .8 : .5, audienceFit: .7,
    freshness: normalizedMomentum, saturation: Number(signal.evidence.saturation ?? 0),
    confidence: Number(signal.evidence.confidence ?? .6), historicalFit: Number(signal.evidence.historicalFit ?? .5),
    marginalCostPenalty: Number(signal.evidence.marginalCostPenalty ?? 0),
  })
  return {
    thesis: `${signal.topic}: conteúdo que resolve a dor percebida`,
    angle: signal.painPoint ?? `Tendência em crescimento: ${signal.topic}`,
    hook: signal.question ?? `O que ninguém está te contando sobre ${signal.topic}?`,
    evidence: signal.evidence,
    score,
  }
}

export function createContentOpportunityProcessor(repository: ContentOpportunityRepository) {
  const gate = createWorker<ContentOpportunityPayload>(spec)
  return async (job: WorkerJob<ContentOpportunityPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const signals = await repository.signals(job.payload)
    for (const signal of signals) await repository.save(job.payload, signal)
    return { ...base, event: { kind: 'content-opportunity.completed', payload: { created: signals.length } } }
  }
}

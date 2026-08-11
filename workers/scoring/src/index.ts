import { computeScore, type Priority, type ScoreInput, type ScoreWeights } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'scoring', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export const scoreLead = (input: ScoreInput, weights: ScoreWeights) => computeScore(input, weights)

export interface ScoringPayload { leadId: string; campaignId: string; trigger: string }
export interface ScoringRepository {
  load(leadId: string, campaignId: string): Promise<{ input: ScoreInput; weights: ScoreWeights; previousPriority?: Priority }>
  save(leadId: string, campaignId: string, result: ReturnType<typeof computeScore>, previousPriority?: Priority): Promise<void>
}

export function createScoringProcessor(repository: ScoringRepository) {
  const gate = createWorker<ScoringPayload>(spec)
  return async (job: WorkerJob<ScoringPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const state = await repository.load(job.payload.leadId, job.payload.campaignId)
    const result = scoreLead(state.input, state.weights)
    await repository.save(job.payload.leadId, job.payload.campaignId, result, state.previousPriority)
    return { ...base, event: { kind: 'scoring.completed', payload: { leadId: job.payload.leadId, campaignId: job.payload.campaignId, finalScore: result.finalScore, priority: result.priority, previousPriority: state.previousPriority } } }
  }
}

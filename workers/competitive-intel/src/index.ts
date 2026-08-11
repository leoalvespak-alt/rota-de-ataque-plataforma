import { classifyComment, type Classification } from '@plataforma/nlp'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'competitive-intel', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface CompetitivePayload { campaignId?: string; competitorId?: string; windowDays?: number }
export interface CompetitiveDocument { competitorId: string; text: string; sourceId: string }
export interface CompetitiveRepository { documents(payload: CompetitivePayload): Promise<CompetitiveDocument[]>; persist(document: CompetitiveDocument, classification: Classification, embedding: number[]): Promise<void>; refreshTrends(): Promise<void> }
export interface IntelligenceAi { embed(text: string): Promise<number[]>; complete(prompt: string): Promise<string> }

export function createCompetitiveIntelProcessor(repository: CompetitiveRepository, ai: IntelligenceAi) {
  const gate = createWorker<CompetitivePayload>(spec)
  return async (job: WorkerJob<CompetitivePayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const documents = await repository.documents(job.payload)
    let processed = 0
    for (const document of documents) {
      const classification = await classifyComment(document.text, (prompt) => ai.complete(prompt))
      if (!classification) continue
      await repository.persist(document, classification, await ai.embed(document.text))
      processed++
    }
    await repository.refreshTrends()
    return { ...base, event: { kind: 'competitive-intel.completed', payload: { processed } } }
  }
}

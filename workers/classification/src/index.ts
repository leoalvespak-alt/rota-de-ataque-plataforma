import { classifyComment, cheapFilter, type Classification } from '@plataforma/nlp'
import { classificationLatency, classificationLlmErrors } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'classification', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)

export interface ClassificationPayload { commentId: string; leadId: string; campaignId: string; scope: 'competitor' | 'own' }
export interface ClassificationRepository {
  comment(scope: 'competitor' | 'own', id: string): Promise<{ text: string } | null>
  save(id: string, scope: 'competitor' | 'own', classification: Classification, embedding: number[]): Promise<void>
}
export interface ClassificationQueue { scoring(leadId: string, campaignId: string): Promise<void>; privateReply?(commentId: string): Promise<void> }
export interface ClassificationNlp { embed(text: string): Promise<number[]>; complete(prompt: string): Promise<string> }

export function createClassificationProcessor(repository: ClassificationRepository, queue: ClassificationQueue, nlp: ClassificationNlp) {
  const gate = createWorker<ClassificationPayload>(spec)
  return async (job: WorkerJob<ClassificationPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const row = await repository.comment(job.payload.scope, job.payload.commentId)
    if (!row) throw new Error(`Comment ${job.payload.scope}:${job.payload.commentId} not found`)
    if (cheapFilter(row.text)) return { ...base, event: { kind: 'classification.filtered', payload: { commentId: job.payload.commentId } } }
    const started = Date.now()
    try {
      const [embedding, classification] = await Promise.all([nlp.embed(row.text), classifyComment(row.text, (prompt) => nlp.complete(prompt))])
      if (!classification) return { ...base, event: { kind: 'classification.filtered', payload: { commentId: job.payload.commentId } } }
      await repository.save(job.payload.commentId, job.payload.scope, classification, embedding)
      await queue.scoring(job.payload.leadId, job.payload.campaignId)
      if (job.payload.scope === 'own') await queue.privateReply?.(job.payload.commentId)
      return { ...base, event: { kind: 'classification.completed', payload: { commentId: job.payload.commentId, confidence: classification.confidence } } }
    } catch (error) {
      classificationLlmErrors.inc()
      throw error
    } finally {
      classificationLatency.observe(Date.now() - started)
    }
  }
}

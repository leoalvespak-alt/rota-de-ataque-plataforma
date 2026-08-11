import type { ExtractedComment } from '@plataforma/browser'
import { extractionCoverage, extractionCoverageMetric } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'extraction', requiredRole: 'collector', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export const shouldPauseExtraction = (input: { successRate: number; checkpoints: number; acknowledged: boolean }) => (input.successRate < .9 || input.checkpoints > 0) && !input.acknowledged
export const coverageForPost = (collected: number, shown: number) => ({ value: extractionCoverage(collected, shown), alert: shown > 100 && extractionCoverage(collected, shown) < .6 })

export interface ExtractionPayload { postId: string; campaignId: string; competitorId: string; accountId: string; postUrl: string; commentCountShown: number; runId: string }
export interface ExtractionHealth { successRate: number; checkpoints: number; acknowledged: boolean }
export interface ExtractionRepository {
  health(accountId: string): Promise<ExtractionHealth>
  startRun(payload: ExtractionPayload): Promise<string>
  saveComment(payload: ExtractionPayload, comment: ExtractedComment): Promise<{ commentId: string; leadId: string; inserted: boolean }>
  finishRun(runId: string, result: { itemsSeen: number; itemsNew: number; coverage: number; status: string }): Promise<void>
  pauseAccount(accountId: string, hours: number): Promise<void>
  alert(kind: string, severity: 'warn' | 'critical', payload: Record<string, unknown>): Promise<void>
}
export interface ExtractionQueue { classification(commentId: string, payload: Record<string, unknown>): Promise<void> }
export interface CommentExtractor { extract(payload: ExtractionPayload): Promise<ExtractedComment[]> }

export function createExtractionProcessor(repository: ExtractionRepository, queue: ExtractionQueue, extractor: CommentExtractor) {
  const gate = createWorker<ExtractionPayload>(spec)
  return async (job: WorkerJob<ExtractionPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const health = await repository.health(job.payload.accountId)
    if (shouldPauseExtraction(health)) {
      await repository.pauseAccount(job.payload.accountId, 6)
      await repository.alert('extraction_circuit_breaker', 'critical', { accountId: job.payload.accountId, ...health, cooldownHours: 6 })
      throw Object.assign(new Error('Extraction circuit breaker open for 6h'), { reasonCode: 'CHECKPOINT' })
    }
    const crawlRunId = await repository.startRun(job.payload)
    try {
      const comments = await extractor.extract(job.payload)
      let inserted = 0
      for (const comment of comments) {
        const saved = await repository.saveComment(job.payload, comment)
        if (!saved.inserted) continue
        inserted += 1
        await queue.classification(saved.commentId, { commentId: saved.commentId, leadId: saved.leadId, campaignId: job.payload.campaignId, scope: 'competitor' })
      }
      const coverage = coverageForPost(comments.length, job.payload.commentCountShown)
      extractionCoverageMetric.observe(coverage.value)
      if (coverage.alert) await repository.alert('extraction_low_coverage', 'warn', { postId: job.payload.postId, collected: comments.length, shown: job.payload.commentCountShown, coverage: coverage.value })
      await repository.finishRun(crawlRunId, { itemsSeen: comments.length, itemsNew: inserted, coverage: coverage.value, status: 'completed' })
      return { ...base, event: { kind: 'extraction.completed', payload: { postId: job.payload.postId, collected: comments.length, inserted, coverage: coverage.value } } }
    } catch (error) {
      await repository.finishRun(crawlRunId, { itemsSeen: 0, itemsNew: 0, coverage: 0, status: 'failed' })
      throw error
    }
  }
}

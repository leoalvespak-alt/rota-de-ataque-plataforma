import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'data-quality', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface DataQualityPayload { campaignId?: string; refreshViews?: boolean }
export interface DataQualityRepository { repair(payload: DataQualityPayload, traceId: string): Promise<Record<string, number>> }

export function createDataQualityProcessor(repository: DataQualityRepository) {
  const gate = createWorker<DataQualityPayload>(spec)
  return async (job: WorkerJob<DataQualityPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const result = await repository.repair(job.payload, base.traceId)
    return { ...base, event: { kind: 'data-quality.completed', payload: result } }
  }
}

import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'conversion-tracking', requiresMetaToken: true } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface ConversionPayload { accountId: string; campaignId?: string }
export interface ProfileSnapshotInput { followers: number; follows: number; posts: number; reach7d?: number; impressions7d?: number }
export interface ConversionRepository { snapshot(payload: ConversionPayload): Promise<ProfileSnapshotInput>; persist(payload: ConversionPayload, snapshot: ProfileSnapshotInput, traceId: string): Promise<{ conversions: number }> }

export function createConversionTrackingProcessor(repository: ConversionRepository) {
  const gate = createWorker<ConversionPayload>(spec)
  return async (job: WorkerJob<ConversionPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const snapshot = await repository.snapshot(job.payload)
    const result = await repository.persist(job.payload, snapshot, base.traceId)
    return { ...base, event: { kind: 'conversion-tracking.completed', payload: result } }
  }
}

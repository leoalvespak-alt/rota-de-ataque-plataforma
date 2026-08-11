import { sourceRoi } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'source-roi', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export const computeSourceScore = sourceRoi
export const ema = (current: number, observed: number, alpha = .1) => current * (1 - alpha) + observed * alpha
export interface SourceRoiPayload { campaignId?: string; windowDays?: 7 | 30; apply?: boolean }
export interface SourceRoiRepository { aggregate(payload: SourceRoiPayload, traceId: string): Promise<{sources:number;suggestions:number;regressions:number}> }
export function createSourceRoiProcessor(repository: SourceRoiRepository) { const gate = createWorker<SourceRoiPayload>(spec); return async (job: WorkerJob<SourceRoiPayload>): Promise<WorkerResult> => { const base = await gate(job); const result = await repository.aggregate(job.payload, base.traceId); return { ...base, event: { kind: 'source-roi.completed', payload: result } } } }

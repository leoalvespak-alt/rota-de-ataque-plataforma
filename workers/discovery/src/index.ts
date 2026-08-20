import { z } from 'zod'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'
import type { ProviderObservation } from '@plataforma/organic-intelligence'

export const spec = { queue: 'discovery', requiredRole: 'collector' } satisfies WorkerSpec
export const processJob = createWorker(spec)
export const discoveryPayloadSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('web_search'), campaignId: z.string().uuid(), query: z.string().min(2).max(500), limit: z.number().int().min(1).max(25).optional() }).strict(),
  z.object({ mode: z.literal('social_collect'), campaignId: z.string().uuid(), platform: z.enum(['instagram', 'tiktok', 'youtube']), urls: z.array(z.string().url()).min(1).max(25), limit: z.number().int().min(1).max(500).optional() }).strict(),
  z.object({ mode: z.literal('fallback_collect'), campaignId: z.string().uuid(), platform: z.enum(['web', 'x', 'google']), urls: z.array(z.string().url()).min(1).max(10), fallbackReason: z.enum(['primary_not_supported', 'primary_failed', 'primary_incomplete', 'validation_sample']) }).strict(),
])
export type DiscoveryPayload = z.infer<typeof discoveryPayloadSchema>
export interface ProviderPlan { provider: 'exa' | 'apify' | 'bright_data'; operation: string; estimatedUsd: number; fallbackReason?: 'primary_not_supported' | 'primary_failed' | 'primary_incomplete' | 'validation_sample' }
export interface DiscoveryResult { observations: ProviderObservation[]; estimatedUsd: number; actualUsd: number | null; externalReference?: string; attempts?: number; durationMs?: number }
export interface DiscoveryProvider { plan(payload: DiscoveryPayload): ProviderPlan; discover(payload: DiscoveryPayload, signal?: AbortSignal): Promise<DiscoveryResult> }
export interface DiscoveryRepository {
  start(payload: DiscoveryPayload, traceId: string, plan: ProviderPlan): Promise<{ runId: string; reservationId: string }>
  complete(runId: string, reservationId: string, plan: ProviderPlan, result: DiscoveryResult, traceId: string): Promise<{ inserted: number; candidates: number }>
  fail(runId: string, reservationId: string, error: unknown): Promise<void>
}

export function createDiscoveryProcessor(repository: DiscoveryRepository, provider: DiscoveryProvider) {
  const gate = createWorker<DiscoveryPayload>(spec)
  return async (job: WorkerJob<DiscoveryPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const parsed = discoveryPayloadSchema.safeParse(job.payload)
    if (!parsed.success) throw Object.assign(new Error('Discovery payload is invalid'), { reasonCode: 'VALIDATION_FAILED' })
    const plan = provider.plan(parsed.data)
    const run = await repository.start(parsed.data, base.traceId, plan)
    try {
      const result = await provider.discover(parsed.data)
      const saved = await repository.complete(run.runId, run.reservationId, plan, result, base.traceId)
      return { ...base, event: { kind: 'organic.discovery.completed', payload: { runId: run.runId, provider: plan.provider, ...saved, costUsd: result.actualUsd ?? result.estimatedUsd, costReconciled: result.actualUsd !== null } } }
    } catch (error) { await repository.fail(run.runId, run.reservationId, error); throw error }
  }
}

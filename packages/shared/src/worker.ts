import { assertDmInbound, assertExternalAllowed, assertRole, createTraceId, preflight, toErrorEvent, type AccountRole, type ErrorEvent, type QueueName, type WorkerPreflight } from './index.js'

export interface WorkerSpec { queue: QueueName; requiredRole?: AccountRole; outbound?: boolean; inboundDmOnly?: boolean; requiresMetaToken?: boolean }
export interface WorkerJob<T extends object = Record<string, unknown>> { id: string; payload: T & { synthetic?: boolean; triggerKind?: string }; preflight: WorkerPreflight }
export interface WorkerResult { ok: true; traceId: string; event: { kind: string; payload: unknown } }

export interface HeartbeatSnapshot { jobsDone: number; jobsFailed: number; backlog: number; p95LatencyMs: number; state: string }
export interface HeartbeatStore { beat(worker: string, instanceId: string, snapshot: HeartbeatSnapshot): Promise<void> }

export function startWorkerHeartbeat(worker: string, store: HeartbeatStore, snapshot: () => HeartbeatSnapshot, instanceId = process.env.HOSTNAME ?? crypto.randomUUID(), intervalMs = 30_000) {
  let stopped = false
  const beat = async () => { if (!stopped) await store.beat(worker, instanceId, snapshot()) }
  void beat()
  const timer = setInterval(() => void beat(), intervalMs)
  return async () => { stopped = true; clearInterval(timer); await store.beat(worker, instanceId, { ...snapshot(), state: 'stopped' }) }
}

export function createWorker<T extends object = Record<string, unknown>>(spec: WorkerSpec) {
  return async function process(job: WorkerJob<T>): Promise<WorkerResult> {
    const traceId = createTraceId()
    preflight(spec.requiresMetaToken === false ? { ...job.preflight, tokenValid: true } : job.preflight, spec.requiredRole)
    if (spec.requiredRole && job.preflight.accountRole) assertRole(job.preflight.accountRole, spec.queue === 'extraction' || spec.queue === 'discovery' || spec.queue === 'follower-mining' || spec.queue === 'search-mining' || spec.queue === 'live-monitor' ? 'scrape' : spec.queue === 'publisher' ? 'publish' : spec.queue === 'dm-copilot' ? 'dm' : 'follow')
    if (spec.inboundDmOnly) assertDmInbound(job.payload.triggerKind)
    if (spec.outbound) assertExternalAllowed(Boolean(job.payload.synthetic))
    return { ok: true, traceId, event: { kind: `${spec.queue}.processed`, payload: job.payload } }
  }
}

export function workerError(spec: WorkerSpec, job: WorkerJob, error: unknown): ErrorEvent { return toErrorEvent(error, { source: 'worker', worker: spec.queue, job_id: job.id, trace_id: createTraceId(), severity: 'error' }) }

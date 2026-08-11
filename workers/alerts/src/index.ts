import type { ErrorEvent, QueueName } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'alerts', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
type Severity = ErrorEvent['severity']

export type AlertPayload =
  | { kind: 'dead-man'; expectedIntervalSeconds?: number; stagnantWindows?: number }
  | { kind: 'canary'; pipelines?: QueueName[]; timeoutMs?: number }
  | { kind: 'error-event'; event: ErrorEvent }
  | ({ kind?: never } & ErrorEvent)

export interface AlertRepository {
  checkDeadMan(expectedIntervalSeconds: number, stagnantWindows: number, traceId: string): Promise<{ opened: number; resolved: number }>
  runCanaries(pipelines: QueueName[], timeoutMs: number, traceId: string): Promise<{ passed: number; failed: number }>
  routeError(event: ErrorEvent, traceId: string): Promise<{ alertId: string; deliveries: number; severity: Severity }>
}

const defaultPipelines: QueueName[] = ['meta-sync', 'extraction', 'classification', 'scoring']

export function createAlertProcessor(repository: AlertRepository) {
  const gate = createWorker<AlertPayload>(spec)
  return async (job: WorkerJob<AlertPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const payload = job.payload
    if (payload.kind === 'dead-man') {
      const result = await repository.checkDeadMan(
        payload.expectedIntervalSeconds ?? 30,
        payload.stagnantWindows ?? 3,
        base.traceId,
      )
      return { ...base, event: { kind: 'alerts.dead-man.completed', payload: result } }
    }
    if (payload.kind === 'canary') {
      const result = await repository.runCanaries(payload.pipelines ?? defaultPipelines, payload.timeoutMs ?? 60_000, base.traceId)
      return { ...base, event: { kind: 'alerts.canary.completed', payload: result } }
    }
    const event = payload.kind === 'error-event' ? payload.event : payload
    const result = await repository.routeError(event, base.traceId)
    return { ...base, event: { kind: 'alerts.error-routed', payload: result } }
  }
}

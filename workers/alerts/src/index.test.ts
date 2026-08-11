import { describe, expect, it, vi } from 'vitest'
import { createAlertProcessor, spec, type AlertRepository } from './index.js'

const preflight = {
  migrationsCurrent: true,
  embeddingDimension: 384,
  tokenValid: true,
  lockAvailable: true,
  budgetAvailable: true,
  accountStatus: 'HEALTHY' as const,
}

const repository = (): AlertRepository => ({
  checkDeadMan: vi.fn().mockResolvedValue({ opened: 1, resolved: 0 }),
  runCanaries: vi.fn().mockResolvedValue({ passed: 4, failed: 0 }),
  routeError: vi.fn().mockResolvedValue({ alertId: 'alert-1', deliveries: 2, severity: 'critical' }),
})

describe('alerts', () => {
  it('declares the alerts worker contract', () => expect(spec.queue).toBe('alerts'))

  it('runs the dead-man scan with conservative defaults', async () => {
    const repo = repository()
    const result = await createAlertProcessor(repo)({ id: 'dead-man', payload: { kind: 'dead-man' }, preflight })
    expect(repo.checkDeadMan).toHaveBeenCalledWith(30, 3, expect.any(String))
    expect(result.event.kind).toBe('alerts.dead-man.completed')
  })

  it('dispatches synthetic canaries only to configured pipelines', async () => {
    const repo = repository()
    await createAlertProcessor(repo)({
      id: 'canary',
      payload: { kind: 'canary', pipelines: ['classification', 'scoring'], timeoutMs: 5000 },
      preflight,
    })
    expect(repo.runCanaries).toHaveBeenCalledWith(['classification', 'scoring'], 5000, expect.any(String))
  })

  it('routes a structured error event', async () => {
    const repo = repository()
    await createAlertProcessor(repo)({
      id: 'error',
      payload: {
        kind: 'error-event',
        event: {
          source: 'worker', worker: 'classification', trace_id: 'trace-1', severity: 'critical',
          reason_code: 'TIMEOUT', error: 'deadline exceeded', metric: 'latency_ms', observed: 7000, threshold: 5000,
        },
      },
      preflight,
    })
    expect(repo.routeError).toHaveBeenCalledWith(expect.objectContaining({ metric: 'latency_ms' }), expect.any(String))
  })
})

import { describe, expect, it, vi } from 'vitest'
import { cloudSchedulerPayload, cloudTaskPayload, makeTaskRequest, runLocalOnce, taskDefinition } from './index.js'

describe('task runtime', () => {
  it('keeps editorial jobs non-resident and maps destinations', () => {
    expect(taskDefinition('news-radar.daily')).toMatchObject({ destination: 'cloud-run', resident: false })
    expect(cloudSchedulerPayload(makeTaskRequest('news-radar.daily', { date: '2026-09-01' })).target).toBe('cloud-run')
    expect(cloudTaskPayload(makeTaskRequest('publication.due', { publicationId: 'p1' }, { scheduleTime: '2026-09-02T12:00:00Z' })).maxAttempts).toBe(3)
  })

  it('runs a local fallback exactly once by idempotency key', async () => {
    const store = { start: vi.fn().mockResolvedValue({ accepted: true, runId: 'run-1' }), complete: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined) }
    const handler = vi.fn().mockResolvedValue({ ok: true })
    await expect(runLocalOnce(makeTaskRequest('editorial-batch.15day', { batchId: 'b1' }), store, handler)).resolves.toMatchObject({ accepted: true, runId: 'run-1', result: { ok: true } })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(store.complete).toHaveBeenCalledWith('run-1', { ok: true })
  })
})

import { describe, expect, it } from 'vitest'
import { summarizeWorkerHealth } from './health-state'

const now = Date.parse('2026-09-28T21:15:00.000Z')

describe('summarizeWorkerHealth', () => {
  it('ignores stopped historical instances when the durable executor is live', () => {
    const result = summarizeWorkerHealth([
      { worker: 'editorial-executor', last_beat_at: '2026-09-28T20:00:00.000Z', state: 'stopped' },
      { worker: 'editorial-executor', last_beat_at: '2026-09-28T21:14:30.000Z', state: 'running' },
      { worker: 'content-opportunity', last_beat_at: '2026-09-28T20:00:00.000Z', state: 'stopped' },
    ], [
      { worker: 'content-opportunity', desired: false },
      { worker: 'content-item-orchestrator', desired: false },
      { worker: 'news-radar', desired: false },
    ], now, true)

    expect(result).toEqual({ active: 1, stale: 0, missing: 0 })
  })

  it('reports a required worker with an old running heartbeat and a missing worker', () => {
    const result = summarizeWorkerHealth([
      { worker: 'editorial-executor', last_beat_at: '2026-09-28T21:00:00.000Z', state: 'running' },
      { worker: 'content-opportunity', last_beat_at: '2026-09-28T20:00:00.000Z', state: 'stopped' },
    ], [{ worker: 'news-radar', desired: true }], now, true)

    expect(result).toEqual({ active: 0, stale: 1, missing: 1 })
  })

  it('does not require the executor before its durable migration is available', () => {
    const result = summarizeWorkerHealth([
      { worker: 'editorial-executor', last_beat_at: '2026-09-28T20:00:00.000Z', state: 'running' },
    ], [], now, false)

    expect(result).toEqual({ active: 0, stale: 0, missing: 0 })
  })
})

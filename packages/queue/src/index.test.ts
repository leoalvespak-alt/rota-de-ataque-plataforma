import { describe, expect, it, vi } from 'vitest'
import { installPlatformSchedulers, MANAGED_SCHEDULER_CONFIG, nextCadenceExecution, parseCadence, retryPolicy } from './index.js'
import { QUEUE_NAMES } from '@plataforma/shared'

describe('queues', () => {
  it('defines a retry policy for every supported queue and no liker queue', () => {
    expect(QUEUE_NAMES).toContain('content-item-orchestrator')
    expect(QUEUE_NAMES).toContain('contact-policy-engine')
    expect(QUEUE_NAMES).not.toContain('liker-mining')
    expect(Object.keys(retryPolicy).sort()).toEqual([...QUEUE_NAMES].sort())
  })
})

describe('managed scheduler cadence', () => {
  it('keeps one stable primary scheduler id per configurable worker', () => {
    const ids = Object.values(MANAGED_SCHEDULER_CONFIG).map((config) => config!.primaryId)
    expect(ids).toHaveLength(9)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('validates intervals and cron expressions and previews the next execution', () => {
    const from = new Date('2026-08-21T12:00:00.000Z')
    expect(parseCadence('every:60000')).toEqual({ every: 60_000 })
    expect(nextCadenceExecution('every:60000', from).toISOString()).toBe('2026-08-21T12:01:00.000Z')
    expect(parseCadence('0 13 * * *')).toEqual({ pattern: '0 13 * * *', tz: 'UTC' })
    expect(nextCadenceExecution('0 13 * * *', from).toISOString()).toBe('2026-08-21T13:00:00.000Z')
    expect(() => parseCadence('every:abc')).toThrow()
    expect(() => parseCadence('cron inválido')).toThrow()
  })

  it('remove recorrências de workers desligados em vez de acumular jobs', async () => {
    const queues = Object.fromEntries(QUEUE_NAMES.map((name) => [name, {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
      removeJobScheduler: vi.fn().mockResolvedValue(undefined),
    }]))
    const registry = { queues } as unknown as Parameters<typeof installPlatformSchedulers>[0]

    await installPlatformSchedulers(registry, undefined, new Set(['news-radar']))

    expect(queues['news-radar']!.upsertJobScheduler).toHaveBeenCalledTimes(2)
    expect(queues['news-radar']!.removeJobScheduler).not.toHaveBeenCalled()
    expect(queues.publisher!.removeJobScheduler).toHaveBeenCalledWith('publisher-due-1m-v1')
    expect(queues.alerts!.removeJobScheduler).toHaveBeenCalledTimes(2)
  })
})

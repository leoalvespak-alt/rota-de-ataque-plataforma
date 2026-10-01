import { describe, expect, it } from 'vitest'
import { LANE_LIMITS } from './supervisor.js'
import { makeTaskRequest, TASK_DEFINITIONS, taskDefinition } from './index.js'

describe('task runtime', () => {
  it('uses only the supervised local runtime and isolates throughput by lane', () => {
    expect(TASK_DEFINITIONS.every(task => task.destination === 'local')).toBe(true)
    expect(taskDefinition('news-radar.daily')).toMatchObject({ lane: 'heavy', priority: 30 })
    expect(taskDefinition('publication.due')).toMatchObject({ lane: 'publishing', priority: 100 })
    expect(taskDefinition('inbox.message')).toMatchObject({ lane: 'inbound', priority: 90 })
    expect(taskDefinition('inbox.retention.cleanup')).toMatchObject({ cadence: 'daily', lane: 'default', priority: 5 })
    expect(LANE_LIMITS).toMatchObject({ heavy: 1, publishing: 1, inbound: 2 })
  })

  it('creates distinct idempotency identities for simultaneous items and revisions', () => {
    const scheduleTime = '2026-09-28T12:00:00.000Z'
    const one = makeTaskRequest('publication.due', { publicationId: 'p1' }, { scheduleTime, accountId: 'a1', itemId: 'i1', revisionId: 'r1' })
    const two = makeTaskRequest('publication.due', { publicationId: 'p2' }, { scheduleTime, accountId: 'a1', itemId: 'i2', revisionId: 'r1' })
    const revised = makeTaskRequest('publication.due', { publicationId: 'p1' }, { scheduleTime, accountId: 'a1', itemId: 'i1', revisionId: 'r2' })
    expect(new Set([one.idempotencyKey, two.idempotencyKey, revised.idempotencyKey]).size).toBe(3)
    expect(() => makeTaskRequest('publication.due', { publicationId: 'p1' }, { scheduleTime })).toThrow(/requires accountId/u)
  })

  it('requires a stable key for non-item tasks instead of collapsing them into one "now" key', () => {
    expect(() => makeTaskRequest('news-radar.daily', {})).toThrow(/stable occurrence key/u)
    expect(makeTaskRequest('news-radar.daily', {}, { occurrenceKey: '2026-09-27' }).idempotencyKey).toBe('news-radar.daily:2026-09-27')
  })
})

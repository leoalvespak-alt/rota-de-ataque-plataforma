import { describe, expect, it } from 'vitest'
import { nextScheduleAt } from './scheduling.js'

describe('news schedule recurrence', () => {
  it('keeps the two daily runs at noon and 20:00 in Sao Paulo time', () => {
    const next = nextScheduleAt('twice-daily', new Date('2026-09-28T15:00:00.000Z'), new Date('2026-09-28T15:00:00.000Z'), {
      timeZone: 'America/Sao_Paulo',
      times: ['12:00', '20:00'],
    })
    expect(next.toISOString()).toBe('2026-09-28T23:00:00.000Z')
  })

  it('skips missed same-day runs instead of replaying stale scrapes', () => {
    const next = nextScheduleAt('twice-daily', new Date('2026-09-28T15:00:00.000Z'), new Date('2026-09-29T02:00:00.000Z'), {
      timeZone: 'America/Sao_Paulo',
      times: ['12:00', '20:00'],
    })
    expect(next.toISOString()).toBe('2026-09-29T15:00:00.000Z')
  })

  it('preserves existing daily and 15-day catch-up behavior', () => {
    const daily = nextScheduleAt('daily', new Date('2026-09-26T12:00:00.000Z'), new Date('2026-09-28T10:00:00.000Z'))
    const fortnight = nextScheduleAt('every-15-days', new Date('2026-09-01T12:00:00.000Z'), new Date('2026-09-28T10:00:00.000Z'))
    expect(daily.toISOString()).toBe('2026-09-28T12:00:00.000Z')
    expect(fortnight.toISOString()).toBe('2026-10-01T12:00:00.000Z')
  })
})

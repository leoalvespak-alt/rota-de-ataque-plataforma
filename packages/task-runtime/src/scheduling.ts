export type ScheduleCadence = 'daily' | 'every-15-days' | 'twice-daily'

export interface ScheduleConfiguration {
  timeZone?: unknown
  times?: unknown
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number }

function partsInZone(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (key: string) => Number(parts.find((part) => part.type === key)?.value)
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') }
}

function localTimeToUtc(date: Pick<ZonedParts, 'year' | 'month' | 'day'>, hour: number, minute: number, timeZone: string): Date {
  const target = Date.UTC(date.year, date.month - 1, date.day, hour, minute)
  let candidate = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = partsInZone(new Date(candidate), timeZone)
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    const difference = target - represented
    if (difference === 0) break
    candidate += difference
  }
  return new Date(candidate)
}

function nextTwiceDailyOccurrence(now: Date, configuration: ScheduleConfiguration): Date {
  if (configuration.timeZone !== undefined && typeof configuration.timeZone !== 'string') throw new Error('twice-daily timeZone must be a string')
  const timeZone = configuration.timeZone ?? 'America/Sao_Paulo'
  const configuredTimes = configuration.times
  if (configuredTimes !== undefined && (!Array.isArray(configuredTimes) || !configuredTimes.every((time) => typeof time === 'string'))) {
    throw new Error('twice-daily times must be an array of strings')
  }
  const times = (configuredTimes ?? ['12:00', '20:00']).map((time: string) => {
    const match = /^(\d{2}):(\d{2})$/u.exec(time)
    if (!match) throw new Error(`Invalid local schedule time: ${time}`)
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour > 23 || minute > 59) throw new Error(`Invalid local schedule time: ${time}`)
    return { hour, minute }
  }).sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  if (times.length !== 2) throw new Error('twice-daily schedules require exactly two local times')

  const localNow = partsInZone(now, timeZone)
  const localDateUtc = Date.UTC(localNow.year, localNow.month - 1, localNow.day)
  for (let day = 0; day < 8; day += 1) {
    const date = new Date(localDateUtc + day * 86_400_000)
    const localDate = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
    for (const time of times) {
      const candidate = localTimeToUtc(localDate, time.hour, time.minute, timeZone)
      if (candidate > now) return candidate
    }
  }
  throw new Error('Could not find the next local schedule occurrence')
}

export function nextScheduleAt(cadence: ScheduleCadence, scheduledAt: Date, now: Date, configuration: ScheduleConfiguration = {}): Date {
  if (cadence === 'twice-daily') return nextTwiceDailyOccurrence(now, configuration)
  const intervalDays = cadence === 'daily' ? 1 : 15
  const next = new Date(scheduledAt)
  next.setUTCDate(next.getUTCDate() + intervalDays)
  while (next <= now) next.setUTCDate(next.getUTCDate() + intervalDays)
  return next
}

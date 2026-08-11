type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

let minLevel: LogLevel = import.meta.env.PROD ? 'info' : 'debug'

export function setLogLevel(level: LogLevel) {
  minLevel = level
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function createEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }
}

function emit(entry: LogEntry) {
  const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log
  if (entry.context) {
    fn(`[${entry.level.toUpperCase()}] ${entry.message}`, entry.context)
  } else {
    fn(`[${entry.level.toUpperCase()}] ${entry.message}`)
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (shouldLog('debug')) emit(createEntry('debug', message, context))
  },
  info(message: string, context?: Record<string, unknown>) {
    if (shouldLog('info')) emit(createEntry('info', message, context))
  },
  warn(message: string, context?: Record<string, unknown>) {
    if (shouldLog('warn')) emit(createEntry('warn', message, context))
  },
  error(message: string, context?: Record<string, unknown>) {
    if (shouldLog('error')) emit(createEntry('error', message, context))
  },
}

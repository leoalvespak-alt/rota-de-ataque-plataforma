import * as Sentry from '@sentry/react'

let initialized = false

export function initSentry(dsn?: string) {
  if (initialized || !dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
      }
      return event
    },
  })

  initialized = true
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!initialized) {
    console.error('[Sentry not initialized]', error, context)
    return
  }
  Sentry.captureException(error, { extra: context })
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!initialized) {
    console.log(`[${level}]`, message)
    return
  }
  Sentry.captureMessage(message, level)
}

export function setUser(id: string, email?: string) {
  Sentry.setUser({ id, email })
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ message, category, data, level: 'info' })
}

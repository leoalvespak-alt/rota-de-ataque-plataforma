import { NextResponse } from 'next/server'

type PublicError = Error & { status?: number; code?: string; reasonCode?: string }

const publicCodes = new Set([
  'authentication_required',
  'forbidden',
  'invalid_request',
  'invalid_action',
  'not_found',
  'already_decided',
  'invalid_state',
  'conflict',
  'internal_error',
])

function statusFor(error: PublicError) {
  return error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409 || error.status === 422 || error.status === 429 || error.status === 503 ? error.status : 500
}

function codeFor(error: PublicError, fallback: string) {
  const candidate = error.code ?? (error.status === 401 ? 'authentication_required' : error.status === 403 ? 'forbidden' : fallback)
  return publicCodes.has(candidate) ? candidate : fallback
}

export function apiErrorResponse(error: unknown, fallback = 'internal_error') {
  const value: PublicError = error instanceof Error ? error as PublicError : Object.assign(new Error(String(error)), { code: fallback })
  const traceId = crypto.randomUUID()
  const safeLogMessage = value.message.replace(/(authorization|cookie|token|password|secret|email)\s*[:=]\s*[^\s,;]+/giu, '$1=[redacted]').slice(0, 500)
  const status = statusFor(value)
  // Auth and validation denials are expected client states, not server incidents.
  if (status >= 500) console.error({ traceId, error: safeLogMessage, status, reasonCode: value.reasonCode }, 'API request failed')
  return NextResponse.json({ error: codeFor(value, fallback), traceId }, { status })
}

export function invalidRequestResponse(code = 'invalid_request') {
  return NextResponse.json({ error: code, traceId: crypto.randomUUID() }, { status: 400 })
}

export function conflictResponse(code = 'conflict') {
  return NextResponse.json({ error: code, traceId: crypto.randomUUID() }, { status: 409 })
}

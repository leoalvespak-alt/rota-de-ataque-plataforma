import { NextResponse } from 'next/server'

type PublicError = Error & { status?: number; code?: string; reasonCode?: string }
const publicCodes = new Set([
  'authentication_required', 'forbidden', 'invalid_request', 'invalid_action', 'not_found', 'already_decided', 'invalid_state', 'conflict', 'internal_error',
  'NO_INPUT', 'PREREQUISITE_MISSING', 'ACCOUNT_AUTH_REQUIRED', 'PROVIDER_NOT_CONFIGURED', 'BUDGET_NOT_CONFIGURED', 'MIGRATION_DRIFT', 'RUNTIME_UNAVAILABLE',
  'SQL_CONTRACT_ERROR', 'EXTERNAL_PROVIDER_ERROR', 'POLICY_BLOCKED', 'HUMAN_APPROVAL_REQUIRED', 'UNKNOWN',
])
function statusFor(error: PublicError) {
  if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409 || error.status === 422 || error.status === 429 || error.status === 503) return error.status
  if (['PREREQUISITE_MISSING', 'RUNTIME_UNAVAILABLE', 'POLICY_BLOCKED', 'HUMAN_APPROVAL_REQUIRED'].includes(error.reasonCode ?? error.code ?? '')) return 409
  return 500
}
function codeFor(error: PublicError, fallback: string) {
  const candidate = error.code ?? error.reasonCode ?? (error.status === 401 ? 'authentication_required' : error.status === 403 ? 'forbidden' : fallback)
  return publicCodes.has(candidate) ? candidate : fallback
}
const actionByCode: Record<string, { label: string; href: string }> = {
  RUNTIME_UNAVAILABLE: { label: 'Verificar operação', href: '/sistema/saude' },
  PREREQUISITE_MISSING: { label: 'Abrir checklist de prontidão', href: '/sistema/motores' },
  ACCOUNT_AUTH_REQUIRED: { label: 'Vincular conta', href: '/sistema/integracoes' },
  PROVIDER_NOT_CONFIGURED: { label: 'Configurar provedor', href: '/sistema/avancado/ia' },
  HUMAN_APPROVAL_REQUIRED: { label: 'Abrir decisões', href: '/decisoes' },
}
export function apiErrorResponse(error: unknown, fallback = 'internal_error') {
  const value: PublicError = error instanceof Error ? error as PublicError : Object.assign(new Error(String(error)), { code: fallback })
  const traceId = crypto.randomUUID()
  const safeLogMessage = value.message.replace(/(authorization|cookie|token|password|secret|email)\s*[:=]\s*[^\s,;]+/giu, '$1=[redacted]').slice(0, 500)
  const status = statusFor(value)
  const code = codeFor(value, fallback)
  const nextAction = actionByCode[code]
  if (status >= 500) console.error({ traceId, error: safeLogMessage, status, reasonCode: value.reasonCode }, 'API request failed')
  return NextResponse.json({ error: code, code, message: status >= 500 ? 'A operação não pôde ser concluída.' : value.message.slice(0, 500), nextAction, retryable: status >= 500 || code === 'RUNTIME_UNAVAILABLE', traceId }, { status })
}
export function invalidRequestResponse(code = 'invalid_request') { return NextResponse.json({ error: code, traceId: crypto.randomUUID() }, { status: 400 }) }
export function conflictResponse(code = 'conflict') { return NextResponse.json({ error: code, traceId: crypto.randomUUID() }, { status: 409 }) }

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

export class ApiClientError extends Error {
  readonly kind: 'timeout' | 'network' | 'http' | 'aborted'
  readonly status?: number
  readonly requestId?: string

  constructor(
    message: string,
    kind: 'timeout' | 'network' | 'http' | 'aborted',
    status?: number,
    requestId?: string,
  ) {
    super(message)
    this.kind = kind
    this.status = status
    this.requestId = requestId
  }
}

export function normalizePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`
  return withSlash.replace(/^(?:\/api)+(?=\/|$)/, '') || '/'
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const requestId = headers.get('X-Request-ID') ?? crypto.randomUUID()
  headers.set('X-Request-ID', requestId)
  if (!['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase())) {
    const csrf = typeof document === 'undefined'
      ? undefined
      : document.cookie.split('; ').find((entry) => entry.startsWith('rda_design_csrf='))?.split('=')[1]
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf))
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort('timeout'), 30_000)
  const abort = () => controller.abort('caller')
  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    const response = await fetch(`${API_BASE}${normalizePath(path)}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    })
    const responseRequestId = response.headers.get('X-Request-ID') ?? requestId
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      throw new ApiClientError(payload?.error ?? `API ${response.status}`, 'http', response.status, responseRequestId)
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
  } catch (error) {
    if (error instanceof ApiClientError) throw error
    if (controller.signal.aborted) {
      const timedOut = controller.signal.reason === 'timeout'
      throw new ApiClientError(timedOut ? 'Tempo limite da API excedido.' : 'Requisição cancelada.', timedOut ? 'timeout' : 'aborted', undefined, requestId)
    }
    throw new ApiClientError('Falha de rede ao acessar a API.', 'network', undefined, requestId)
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}

export { API_BASE }

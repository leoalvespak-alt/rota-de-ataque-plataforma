export type PublicApiMethod = 'GET' | 'POST'

export interface PublicApiRouteRule {
  path: string
  methods: readonly PublicApiMethod[]
  reason: 'auth' | 'health' | 'webhook'
}

/** Public authentication and health routes that do not require a session. */
export const PUBLIC_API_ROUTES: readonly PublicApiRouteRule[] = [
  { path: '/api/auth', methods: ['GET', 'POST'], reason: 'auth' },
  { path: '/api/health', methods: ['GET'], reason: 'health' },
  { path: '/api/health/live', methods: ['GET'], reason: 'health' },
  { path: '/api/health/ready', methods: ['GET'], reason: 'health' },
  { path: '/api/health/operational', methods: ['GET'], reason: 'health' },
  { path: '/api/webhooks/meta', methods: ['GET', 'POST'], reason: 'webhook' },
]

export function isPublicApiPath(pathname: string, method = 'GET') {
  return PUBLIC_API_ROUTES.some(({ path, methods, reason }) =>
    (pathname === path || (reason !== 'webhook' && pathname.startsWith(`${path}/`)))
      && methods.includes(method as PublicApiMethod),
  )
}

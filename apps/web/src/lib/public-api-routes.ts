export type PublicApiMethod = 'GET' | 'POST'

export interface PublicApiRouteRule {
  path: string
  methods: readonly PublicApiMethod[]
  reason: 'auth' | 'health' | 'signed-webhook' | 'public-confirmation' | 'oauth-callback'
}

/** Public routes still validate signatures, tokens, or OAuth state in their handlers. */
export const PUBLIC_API_ROUTES: readonly PublicApiRouteRule[] = [
  { path: '/api/auth', methods: ['GET', 'POST'], reason: 'auth' },
  { path: '/api/health', methods: ['GET'], reason: 'health' },
  { path: '/api/health/live', methods: ['GET'], reason: 'health' },
  { path: '/api/health/ready', methods: ['GET'], reason: 'health' },
  { path: '/api/health/operational', methods: ['GET'], reason: 'health' },
  { path: '/api/meta/webhook', methods: ['GET', 'POST'], reason: 'signed-webhook' },
  { path: '/api/whatsapp/webhook', methods: ['GET', 'POST'], reason: 'signed-webhook' },
  { path: '/api/email/webhook', methods: ['POST'], reason: 'signed-webhook' },
  { path: '/api/email/confirm', methods: ['GET'], reason: 'public-confirmation' },
  { path: '/api/email/subscribe', methods: ['POST'], reason: 'public-confirmation' },
  { path: '/api/whatsapp/optin', methods: ['POST'], reason: 'public-confirmation' },
  { path: '/api/meta/oauth/callback', methods: ['GET'], reason: 'oauth-callback' },
]

export function isPublicApiPath(pathname: string, method = 'GET') {
  return PUBLIC_API_ROUTES.some(({ path, methods }) =>
    (pathname === path || pathname.startsWith(`${path}/`))
      && methods.includes(method as PublicApiMethod),
  )
}

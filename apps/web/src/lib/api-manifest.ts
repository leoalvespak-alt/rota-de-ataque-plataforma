export type ApiAuthMode = 'public' | 'session'

export interface ApiRouteManifestEntry {
  path: string
  auth: ApiAuthMode
  methods: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[]
}

/** Generated from every route.ts under apps/web/src/app/api. Keep this list exhaustive. */
export const API_ROUTE_MANIFEST = [
  { path: '/api/admin/ai', auth: 'session', methods: ['GET', 'POST'] as const },
  { path: '/api/admin/automation-incidents/:id/acknowledge', auth: 'session', methods: ['POST'] as const },
  { path: '/api/admin/content-suggestions/:id/action', auth: 'session', methods: ['POST'] as const },
  { path: '/api/admin/radar-findings/:id/action', auth: 'session', methods: ['POST'] as const },
  { path: '/api/auth/:nextauth*', auth: 'public', methods: ['GET', 'POST'] as const },
  { path: '/api/auth/otp', auth: 'public', methods: ['POST'] as const },
  { path: '/api/content-items', auth: 'session', methods: ['POST'] as const },
  { path: '/api/content-items/:id', auth: 'session', methods: ['PATCH', 'DELETE'] as const },
  { path: '/api/content-items/:id/approve', auth: 'session', methods: ['POST'] as const },
  { path: '/api/content-items/:id/fork', auth: 'session', methods: ['POST'] as const },
  { path: '/api/content-opportunities/:id', auth: 'session', methods: ['POST'] as const },
  { path: '/api/content-opportunities/:id/creative', auth: 'session', methods: ['GET', 'POST'] as const },
  { path: '/api/content/funnel', auth: 'session', methods: ['GET'] as const },
  { path: '/api/context/campaign', auth: 'session', methods: ['POST'] as const },
  { path: '/api/creative-bridge', auth: 'session', methods: ['GET'] as const },
  { path: '/api/creative-bridge/:id', auth: 'session', methods: ['PATCH'] as const },
  { path: '/api/creative-bridge/:id/return', auth: 'session', methods: ['POST'] as const },
  { path: '/api/dashboard/today', auth: 'session', methods: ['GET'] as const },
  { path: '/api/editorial/batches', auth: 'session', methods: ['GET', 'POST'] as const },
  { path: '/api/editorial/batches/:id/items/:itemId/action', auth: 'session', methods: ['POST'] as const },
  { path: '/api/health', auth: 'public', methods: ['GET'] as const },
  { path: '/api/health/live', auth: 'public', methods: ['GET'] as const },
  { path: '/api/health/operational', auth: 'public', methods: ['GET'] as const },
  { path: '/api/health/ready', auth: 'public', methods: ['GET'] as const },
  { path: '/api/integrations/capabilities', auth: 'session', methods: ['GET'] as const },
  { path: '/api/kill-switch', auth: 'session', methods: ['GET', 'POST'] as const },
  { path: '/api/metrics', auth: 'session', methods: ['GET'] as const },
  { path: '/api/performance/content/export', auth: 'session', methods: ['GET'] as const },
  { path: '/api/review-inbox/:id/:action', auth: 'session', methods: ['POST'] as const },
  { path: '/api/theses', auth: 'session', methods: ['GET', 'POST', 'PATCH'] as const },
] as const satisfies readonly ApiRouteManifestEntry[]

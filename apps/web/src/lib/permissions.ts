import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { assertRoleAccess, type AppRole } from './role-access'

export type AuthenticatedUser = { id?: string; email?: string | null; role: AppRole }

export async function requireRole(minimum: AppRole): Promise<AuthenticatedUser> {
  const localBootstrap = process.env.AUTH_BOOTSTRAP_VIEWER === 'true'
    && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
  if (localBootstrap && minimum === 'viewer') return { id: 'bootstrap-viewer', email: 'bootstrap-viewer@local', role: 'viewer' as const }
  const session = await getServerSession(authOptions)
  assertRoleAccess(session?.user as { role?: AppRole } | null, minimum)
  return session!.user as AuthenticatedUser
}

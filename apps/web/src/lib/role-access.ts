export type AppRole = 'viewer' | 'operator' | 'admin'

export function assertRoleAccess(user: { role?: string } | null | undefined, minimum: AppRole) {
  if (!user?.role) throw Object.assign(new Error('Authentication required'), { status: 401, code: 'authentication_required' })
  const rank = { viewer: 0, operator: 1, admin: 2 }
  const userRank = rank[user.role as AppRole]
  if (userRank === undefined || userRank < rank[minimum]) throw Object.assign(new Error('Forbidden'), { status: 403, code: 'forbidden' })
}

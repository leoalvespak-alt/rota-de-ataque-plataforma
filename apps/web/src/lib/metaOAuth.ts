import { createHmac, timingSafeEqual } from 'node:crypto'

export type MetaAccountRole = 'collector' | 'actor'
export function signMetaState(role: MetaAccountRole, secret: string) {
  const payload = Buffer.from(JSON.stringify({ role, exp: Date.now() + 10 * 60_000 })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}
export function verifyMetaState(state: string, secret: string): MetaAccountRole {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) throw new Error('Invalid OAuth state')
  const expected = createHmac('sha256', secret).update(payload).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid OAuth state signature')
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: string; exp?: number }
  if (!decoded.exp || decoded.exp < Date.now() || (decoded.role !== 'collector' && decoded.role !== 'actor')) throw new Error('Expired OAuth state')
  return decoded.role
}

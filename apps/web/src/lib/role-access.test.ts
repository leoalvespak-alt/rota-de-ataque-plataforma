import { describe, expect, it } from 'vitest'
import { assertRoleAccess } from './role-access'

describe('dashboard and admin authorization contract', () => {
  it('distinguishes no session, insufficient role and allowed role', () => {
    expect(() => assertRoleAccess(null, 'viewer')).toThrowError(expect.objectContaining({ status: 401, code: 'authentication_required' }))
    expect(() => assertRoleAccess({ role: 'viewer' }, 'operator')).toThrowError(expect.objectContaining({ status: 403, code: 'forbidden' }))
    expect(() => assertRoleAccess({ role: 'invalid' }, 'viewer')).toThrowError(expect.objectContaining({ status: 403, code: 'forbidden' }))
    expect(() => assertRoleAccess({ role: 'operator' }, 'operator')).not.toThrow()
    expect(() => assertRoleAccess({ role: 'admin' }, 'operator')).not.toThrow()
  })
})

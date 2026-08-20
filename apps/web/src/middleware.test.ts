import { describe, expect, it, vi, beforeAll } from 'vitest'
import { authRedirectPaths } from './middleware'

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }))

beforeAll(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = '/prospector'
  process.env.NEXTAUTH_SECRET = 'test-secret'
})

describe('authRedirectPaths', () => {
  it('keeps authentication and callback inside the deployed base path', () => {
    expect(authRedirectPaths('/radar', '', '/prospector')).toEqual({
      relativePath: '/radar',
      loginPath: '/prospector/login',
      callbackPath: '/prospector/radar',
    })
  })

  it('does not duplicate a base path already present', () => {
    expect(authRedirectPaths('/prospector/content-items', '?status=draft', '/prospector')).toEqual({
      relativePath: '/content-items',
      loginPath: '/prospector/login',
      callbackPath: '/prospector/content-items?status=draft',
    })
  })
})

describe('middleware — Location header', () => {
  it('redireciona para login sem duplicar basePath', async () => {
    const { default: middleware } = await import('./middleware')
    const { NextRequest } = await import('next/server')
    const req = new NextRequest(new URL('https://design.rotadeataque.com.br/prospector/leads'))
    const response = await middleware(req)
    expect(response.headers.get('location')).toBe(
      'https://design.rotadeataque.com.br/prospector/login?callbackUrl=%2Fprospector%2Fleads',
    )
  })

  it('não redireciona a própria tela de login', async () => {
    const { default: middleware } = await import('./middleware')
    const { NextRequest } = await import('next/server')
    const req = new NextRequest(new URL('https://design.rotadeataque.com.br/prospector/login'))
    const response = await middleware(req)
    expect(response.headers.get('location')).toBeNull()
  })
})

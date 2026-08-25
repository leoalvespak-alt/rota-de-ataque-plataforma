import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicApiPath } from '@/lib/public-api-routes'

const isLocalBootstrap = () => process.env.AUTH_BOOTSTRAP_VIEWER === 'true'
  && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')

function normalizedBasePath(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, '') ?? ''
  return request.nextUrl.basePath || (configured === '/' ? '' : configured)
}

export function authRedirectPaths(pathname: string, search: string, basePath: string) {
  const relative = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname
  return {
    relativePath: relative,
    loginPath: `${basePath}/login`,
    callbackPath: `${basePath}${relative}${search}`,
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/u, '') ?? ''
  const relativeApiPath = configuredBasePath && pathname.startsWith(configuredBasePath) ? pathname.slice(configuredBasePath.length) || '/' : pathname
  if (isPublicApiPath(relativeApiPath, request.method) || pathname.startsWith('/_next/') || pathname === '/favicon.ico') return NextResponse.next()

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const bootstrapViewer = isLocalBootstrap()
  if (token || bootstrapViewer) return NextResponse.next()

  if (relativeApiPath.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'authentication_required', traceId: crypto.randomUUID() },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    )
  }

  const basePath = normalizedBasePath(request)
  const { relativePath, loginPath, callbackPath } = authRedirectPaths(pathname, request.nextUrl.search, basePath)

  if (relativePath === '/login') return NextResponse.next()

  const login = new URL(loginPath, request.url)
  login.searchParams.set('callbackUrl', callbackPath)
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)'] }

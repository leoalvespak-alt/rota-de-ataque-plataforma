import { withAuth } from 'next-auth/middleware'
export default withAuth({callbacks:{authorized:({token,req})=>process.env.AUTH_BOOTSTRAP_VIEWER==='true'||req.nextUrl.pathname.endsWith('/login')||Boolean(token)}})
export const config={matcher:['/((?!api/auth|_next/static|_next/image|favicon.ico).*)']}

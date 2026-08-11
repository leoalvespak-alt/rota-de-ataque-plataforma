import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
export async function requireRole(minimum:'viewer'|'operator'|'admin'){if(process.env.AUTH_BOOTSTRAP_VIEWER==='true'&&minimum==='viewer')return{id:'bootstrap-viewer',email:'bootstrap-viewer@local',role:'viewer' as const};const session=await getServerSession(authOptions);const rank={viewer:0,operator:1,admin:2};if(!session?.user||rank[session.user.role]<rank[minimum])throw Object.assign(new Error('Forbidden'),{status:403});return session.user}

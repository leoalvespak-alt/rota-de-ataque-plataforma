import { createDatabase } from '@plataforma/db'
import { EngagementClient } from './EngagementClient'

export const dynamic='force-dynamic'
export default async function EngagementQueuePage(){const{pool}=createDatabase(process.env.DATABASE_URL!);try{const[actions,policies]=await Promise.all([
  pool.query(`SELECT e.*,a.role,a.username,e.id::text trace_id FROM engagement_actions e JOIN accounts a ON a.id=e.account_id WHERE (e.status IN ('pending','awaiting_approval','running','blocked') OR e.created_at>now()-interval '24 hours') ORDER BY e.created_at DESC LIMIT 500`),
  pool.query(`SELECT p.action_type,p.daily_limit,p.enabled,a.role,(SELECT health_score FROM account_health h WHERE h.account_id=a.id ORDER BY captured_at DESC LIMIT 1) health_score FROM action_policies p JOIN accounts a ON a.id=p.account_id ORDER BY a.role,p.action_type`),
]);return <EngagementClient actions={actions.rows} policies={policies.rows}/>}finally{await pool.end()}}

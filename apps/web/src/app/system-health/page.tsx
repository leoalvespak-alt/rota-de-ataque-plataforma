import { createDatabase } from '@plataforma/db'
import { SystemHealthClient } from './SystemHealthClient'

export const dynamic = 'force-dynamic'
export default async function SystemHealthPage(){
  const { pool }=createDatabase(process.env.DATABASE_URL!)
  try{
    const [heartbeats,alerts,health]=await Promise.all([
      pool.query(`SELECT worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state FROM worker_heartbeats ORDER BY worker,instance_id`),
      pool.query(`SELECT id,kind,severity,created_at FROM alerts WHERE resolved_at IS NULL ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END,created_at DESC LIMIT 50`),
      pool.query<{ score:string }>(`SELECT COALESCE(AVG(health_score),100)::text score FROM (SELECT DISTINCT ON(account_id) account_id,health_score FROM account_health ORDER BY account_id,captured_at DESC) h`),
    ])
    return <SystemHealthClient heartbeats={heartbeats.rows} alerts={alerts.rows} healthScore={Math.round(Number(health.rows[0]?.score??100))} currentTime={Date.now()}/>
  }finally{await pool.end()}
}

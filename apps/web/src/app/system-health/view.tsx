import { createDatabase } from "@plataforma/db";
import { SystemHealthClient } from "./SystemHealthClient";
import { getIntegrationCapabilities } from "@/lib/integration-capabilities";
import { QUEUE_NAMES } from "@plataforma/shared/client";

export default async function SystemHealthPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!);
  const [heartbeats, alerts, health, canaries, capabilities, killSwitch, workerSettings] = await Promise.all([
    pool.query(`SELECT worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state FROM worker_heartbeats ORDER BY worker,instance_id`),
    pool.query(`SELECT id,reason_code kind,CASE WHEN retryable THEN 'warn' ELSE 'error' END severity,occurred_at created_at FROM automation_incidents WHERE resolved_at IS NULL ORDER BY occurred_at DESC LIMIT 50`),
    pool.query<{ score: string }>(`SELECT COALESCE(AVG(health_score),100)::text score FROM (SELECT DISTINCT ON(account_id) account_id,health_score FROM account_health ORDER BY account_id,captured_at DESC) h`),
    pool.query(`SELECT DISTINCT ON(pipeline) pipeline,status,latency_ms,error,finished_at FROM canary_runs ORDER BY pipeline,finished_at DESC NULLS LAST`),
    getIntegrationCapabilities(pool),
    pool.query<{ enabled: boolean }>(`SELECT enabled FROM runtime_controls WHERE control_key='kill-switch:global'`),
    pool.query<{ worker_name: string; enabled: boolean }>(`SELECT worker_name, enabled FROM worker_settings`),
  ]);
  const enabledByDb = new Map(workerSettings.rows.map((row) => [row.worker_name, row.enabled]));
  const queueCounts = QUEUE_NAMES.map((worker) => ({ worker, desired: enabledByDb.get(worker) ?? false, waiting: 0, delayed: 0, active: 0, failed: 0 }));
  return <SystemHealthClient heartbeats={heartbeats.rows} alerts={alerts.rows} healthScore={Math.round(Number(health.rows[0]?.score ?? 100))} currentTime={Date.now()} canaries={canaries.rows} capabilities={capabilities} killSwitchEnabled={killSwitch.rows[0]?.enabled === true} workers={queueCounts} />;
}

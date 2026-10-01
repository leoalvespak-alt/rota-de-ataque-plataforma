import { createDatabase } from "@plataforma/db";
import { SystemHealthClient } from "./SystemHealthClient";
import { getIntegrationCapabilities } from "@/lib/integration-capabilities";
import { QUEUE_NAMES } from "@plataforma/shared/client";

export default async function SystemHealthPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!);
  const [heartbeats, alerts, health, canaries, capabilities, killSwitch, workerSettings, taskRuns, taskSchedules] = await Promise.all([
    pool.query(`SELECT worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state FROM worker_heartbeats ORDER BY worker,instance_id`),
    pool.query(`SELECT id,reason_code kind,CASE WHEN retryable THEN 'warn' ELSE 'error' END severity,occurred_at created_at FROM automation_incidents WHERE resolved_at IS NULL ORDER BY occurred_at DESC LIMIT 50`),
    pool.query<{ score: string }>(`SELECT COALESCE(AVG(health_score),100)::text score FROM (SELECT DISTINCT ON(account_id) account_id,health_score FROM account_health ORDER BY account_id,captured_at DESC) h`),
    pool.query(`SELECT DISTINCT ON(pipeline) pipeline,status,latency_ms,error,finished_at FROM canary_runs ORDER BY pipeline,finished_at DESC NULLS LAST`),
    getIntegrationCapabilities(pool),
    pool.query<{ enabled: boolean }>(`SELECT enabled FROM runtime_controls WHERE control_key='kill-switch:global'`),
    pool.query<{ worker_name: string; enabled: boolean }>(`SELECT worker_name, enabled FROM worker_settings`),
    pool.query<{ task_name: string; waiting: number; delayed: number; active: number; failed: number }>(`SELECT task_name,
      count(*) FILTER (WHERE status='accepted')::int waiting,
      count(*) FILTER (WHERE status='retry_scheduled')::int delayed,
      count(*) FILTER (WHERE status='running')::int active,
      count(*) FILTER (WHERE status='failed')::int failed
      FROM task_runs GROUP BY task_name ORDER BY task_name`),
    pool.query<{ task_name: string; destination: string; cadence: string; enabled: boolean }>(`SELECT task_name, destination, cadence, enabled FROM task_schedules ORDER BY task_name`),
  ]);
  const executorMigration = await pool.query<{ applied: boolean }>(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='0049_durable_task_executor') AS applied`);
  const recentTaskRuns = executorMigration.rows[0]?.applied
    ? await pool.query<{ id: string; task_name: string; status: string; attempt: number; max_attempts: number; lane: string; priority: number; available_at: string; lease_until: string | null; checkpoint_keys: string; has_error: boolean; created_at: string }>(
      `SELECT id,task_name,status,attempt,max_attempts,lane,priority,available_at,lease_until,
        COALESCE((SELECT string_agg(key, ', ' ORDER BY key) FROM jsonb_object_keys(COALESCE(checkpoint,'{}'::jsonb)) AS keys(key)),'') checkpoint_keys,
        error IS NOT NULL has_error,created_at
       FROM editorial.task_runs ORDER BY created_at DESC LIMIT 20`,
    )
    : { rows: [] };
  const enabledByDb = new Map(workerSettings.rows.map((row) => [row.worker_name, row.enabled]));
  const taskCounts = new Map(taskRuns.rows.map((row) => [row.task_name, row]));
  const taskNames = Array.from(new Set([...QUEUE_NAMES, ...taskCounts.keys()]));
  const queueCounts = taskNames.map((worker) => {
    const counts = taskCounts.get(worker);
    return { worker, desired: enabledByDb.get(worker) ?? false, waiting: counts?.waiting ?? 0, delayed: counts?.delayed ?? 0, active: counts?.active ?? 0, failed: counts?.failed ?? 0 };
  });
  return <SystemHealthClient heartbeats={heartbeats.rows} alerts={alerts.rows} healthScore={Math.round(Number(health.rows[0]?.score ?? 100))} currentTime={Date.now()} canaries={canaries.rows} capabilities={capabilities} killSwitchEnabled={killSwitch.rows[0]?.enabled === true} workers={queueCounts} taskSchedules={taskSchedules.rows} taskRuns={recentTaskRuns.rows} executorReady={executorMigration.rows[0]?.applied === true} />;
}

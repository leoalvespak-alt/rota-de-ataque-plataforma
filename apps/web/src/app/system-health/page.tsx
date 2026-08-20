import { createDatabase } from "@plataforma/db";
import { SystemHealthClient } from "./SystemHealthClient";
import { getIntegrationCapabilities } from "@/lib/integration-capabilities";
import { Redis } from "ioredis";
import { createQueueRegistry } from "@plataforma/queue";
import { QUEUE_NAMES } from "@plataforma/shared";

export default async function SystemHealthPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    const redis = new Redis(process.env.REDIS_URL!);
    const registry = createQueueRegistry(process.env.REDIS_URL!);
    const [heartbeats, alerts, health, canaries, capabilities, killSwitch, workerSettings] =
      await Promise.all([
        pool.query(
          `SELECT worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state FROM worker_heartbeats ORDER BY worker,instance_id`,
        ),
        pool.query(
          `SELECT id,kind,severity,created_at FROM alerts WHERE resolved_at IS NULL ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END,created_at DESC LIMIT 50`,
        ),
        pool.query<{ score: string }>(
          `SELECT COALESCE(AVG(health_score),100)::text score FROM (SELECT DISTINCT ON(account_id) account_id,health_score FROM account_health ORDER BY account_id,captured_at DESC) h`,
        ),
        pool.query(
          `SELECT DISTINCT ON(pipeline) pipeline,status,latency_ms,error,finished_at FROM canary_runs ORDER BY pipeline,finished_at DESC NULLS LAST`,
        ),
        getIntegrationCapabilities(pool),
        redis.get("kill-switch:global"),
        pool.query<{ worker_name: string; enabled: boolean }>(
          `SELECT worker_name, enabled FROM worker_settings`,
        ),
      ]);

    const enabledByDb = new Map(
      workerSettings.rows.map((row) => [row.worker_name, row.enabled]),
    );

    const queueCounts = await Promise.all(
      QUEUE_NAMES.map(async (worker) => {
        // PostgreSQL is canonical; fall back to env var when no DB row exists
        const desired = enabledByDb.has(worker)
          ? (enabledByDb.get(worker) ?? false)
          : process.env[`WORKER_${worker.replaceAll("-", "_").toUpperCase()}_ENABLED`] === "true";
        try {
          const counts = await registry.queues[worker].getJobCounts(
            "waiting",
            "delayed",
            "active",
            "failed",
          );
          return {
            worker,
            desired,
            waiting: counts.waiting ?? 0,
            delayed: counts.delayed ?? 0,
            active: counts.active ?? 0,
            failed: counts.failed ?? 0,
          };
        } catch {
          return { worker, desired, waiting: 0, delayed: 0, active: 0, failed: 0 };
        }
      }),
    );
    await Promise.all(
      QUEUE_NAMES.map((worker) => registry.queues[worker].close()),
    );
    await registry.connection.quit();
    await redis.quit();
    return (
      <SystemHealthClient
        heartbeats={heartbeats.rows}
        alerts={alerts.rows}
        healthScore={Math.round(Number(health.rows[0]?.score ?? 100))}
        currentTime={Date.now()}
        canaries={canaries.rows}
        capabilities={capabilities}
        killSwitchEnabled={killSwitch === "1"}
        workers={queueCounts}
      />
    );
  } finally {
  }
}

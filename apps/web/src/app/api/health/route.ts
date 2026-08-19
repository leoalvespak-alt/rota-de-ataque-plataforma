import { NextResponse } from "next/server";
import { createDatabase } from "@plataforma/db";
import { Redis } from "ioredis";
import { QUEUE_NAMES } from "@plataforma/shared";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  const embeddingsUrl = process.env.EMBEDDINGS_ENDPOINT;
  if (!databaseUrl || !redisUrl || !embeddingsUrl)
    return NextResponse.json(
      { ok: false, error: "missing_runtime_config" },
      { status: 503 },
    );

  const { pool } = createDatabase(databaseUrl);
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
  });
  try {
    const enabledWorkers = QUEUE_NAMES.filter(
      (worker) =>
        process.env[
          `WORKER_${worker.replaceAll("-", "_").toUpperCase()}_ENABLED`
        ] === "true",
    );
    const [database, cache, embeddings, operational] = await Promise.all([
      pool.query("SELECT 1").then(() => "ok"),
      redis
        .connect()
        .then(() => redis.ping())
        .then((value) => (value === "PONG" ? "ok" : "error")),
      fetch(`${embeddingsUrl}/info`, {
        signal: AbortSignal.timeout(3_000),
      }).then((response) => (response.ok ? "ok" : "error")),
      pool.query<{ current: number; failed: number }>(
        `SELECT
          COUNT(DISTINCT worker) FILTER (WHERE last_beat_at > now() - interval '90 seconds')::int current,
          (SELECT COUNT(*)::int FROM failed_jobs WHERE moved_at > now() - interval '24 hours') failed
         FROM worker_heartbeats WHERE worker = ANY($1::text[])`,
        [enabledWorkers],
      ).then((result) => result.rows[0] ?? { current: 0, failed: 0 }),
    ]);
    const workersOk = operational.current === enabledWorkers.length;
    const ok =
      database === "ok" && cache === "ok" && embeddings === "ok" && workersOk;
    return NextResponse.json(
      {
        ok,
        service: "web",
        dependencies: { database, cache, embeddings },
        operational: {
          workersExpected: enabledWorkers.length,
          workersCurrent: operational.current,
          unresolvedFailures: operational.failed,
          status: workersOk ? "ok" : "degraded",
        },
        at: new Date().toISOString(),
      },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "web",
        error: error instanceof Error ? error.name : "healthcheck_failed",
      },
      { status: 503 },
    );
  } finally {
    await redis.quit();
  }
}

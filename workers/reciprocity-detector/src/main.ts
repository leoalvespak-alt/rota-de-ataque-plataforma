import { createDatabase, createPostgresHeartbeatStore } from "@plataforma/db";
import { runWorker } from "@plataforma/queue/runtime";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import {
  createReciprocityProcessor,
  spec,
  type ReciprocityRepository,
} from "./index.js";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const { pool } = createDatabase(databaseUrl);
const repository: ReciprocityRepository = {
  async candidates(hours) {
    return (
      await pool.query(
        `SELECT e.lead_id "leadId",e.account_id "accountId",e.id "actionId",i.kind,EXTRACT(EPOCH FROM(MIN(i.at)-e.completed_at))::int "latencySeconds" FROM engagement_actions e JOIN lead_interactions i ON i.lead_id=e.lead_id AND i.direction='inbound' AND i.at>e.completed_at LEFT JOIN reciprocity_events r ON r.trigger_action_id=e.id WHERE e.action_type='follow' AND e.status='done' AND e.completed_at>=now()-($1||' hours')::interval AND r.id IS NULL GROUP BY e.lead_id,e.account_id,e.id,i.kind,e.completed_at`,
        [hours],
      )
    ).rows;
  },
  async record(candidate, traceId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO reciprocity_events(lead_id,account_id,trigger_action_id,reciprocal_kind,latency_seconds) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM reciprocity_events WHERE trigger_action_id=$3 AND reciprocal_kind=$4) RETURNING id`,
        [
          candidate.leadId,
          candidate.accountId,
          candidate.actionId,
          candidate.kind,
          candidate.latencySeconds,
        ],
      );
      if (result.rowCount)
        await client.query(
          `INSERT INTO events(account_id,scope,level,payload) VALUES($1,'reciprocity','info',$2)`,
          [
            candidate.accountId,
            JSON.stringify({
              type: "reciprocity.detected",
              ...candidate,
              traceId,
            }),
          ],
        );
      await client.query("COMMIT");
      return Boolean(result.rowCount);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
const worker = runWorker(spec.queue, createReciprocityProcessor(repository));
const stop = startWorkerHeartbeat(
  spec.queue,
  createPostgresHeartbeatStore(pool),
  () => ({
    jobsDone: 0,
    jobsFailed: 0,
    backlog: 0,
    p95LatencyMs: 0,
    state: worker?.isRunning() ? "running" : "disabled",
  }),
);
process.once("SIGTERM", () => void stop().finally(() => pool.end()));

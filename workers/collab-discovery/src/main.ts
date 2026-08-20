import { createDatabase, createPostgresHeartbeatStore } from "@plataforma/db";
import { runWorker } from "@plataforma/queue/runtime";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import {
  createCollabProcessor,
  extractMentionCandidates,
  spec,
  type CollabRepository,
} from "./index.js";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const { pool } = createDatabase(databaseUrl);
const repository: CollabRepository = {
  async discover(scheduleId, traceId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const schedule = await client.query(
        `SELECT cs.*,c.username FROM crawl_schedule cs JOIN competitors c ON c.id::text=cs.source_id WHERE cs.id=$1 AND cs.source_type='collab' AND cs.next_run_at<=now() FOR UPDATE`,
        [scheduleId],
      );
      if (!schedule.rowCount)
        throw Object.assign(new Error("Collab schedule is not due"), {
          reasonCode: "PREFLIGHT_FAILED",
        });
      const posts = (
        await client.query<{ postId: string; caption: string }>(
          `SELECT id "postId",COALESCE(caption,'') caption FROM posts WHERE competitor_id=$1 AND posted_at>=now()-interval '90 days'`,
          [schedule.rows[0].source_id],
        )
      ).rows;
      const candidates = extractMentionCandidates(
        posts,
        schedule.rows[0].username,
      );
      for (const candidate of candidates) {
        const shared = await client.query<{ count: string }>(
          `SELECT COUNT(DISTINCT ls.lead_id)::text count FROM lead_sources ls JOIN leads l ON l.id=ls.lead_id WHERE ls.competitor_id=$1 AND EXISTS(SELECT 1 FROM comments c WHERE lower(c.username)=lower($2) AND c.post_id=ls.post_id)`,
          [schedule.rows[0].source_id, candidate.username],
        );
        await client.query(
          `INSERT INTO candidate_sources(username_candidate,discovered_via,relevance_score,overlap_score,evidence) VALUES($1,'mention',$2,$3,$4)`,
          [
            candidate.username,
            Math.min(1, candidate.evidence.length / 5),
            Number(shared.rows[0]?.count ?? 0),
            JSON.stringify({
              sourceCompetitor: schedule.rows[0].source_id,
              items: candidate.evidence,
              traceId,
            }),
          ],
        );
      }
      await client.query(
        `UPDATE crawl_schedule SET last_run_at=now(),next_run_at=now()+current_interval_seconds*interval '1 second' WHERE id=$1`,
        [scheduleId],
      );
      await client.query(
        `INSERT INTO events(campaign_id,scope,level,payload) VALUES($1,'collab','info',$2)`,
        [
          schedule.rows[0].campaign_id,
          JSON.stringify({
            type: "collab.discovery.completed",
            candidates: candidates.length,
            traceId,
          }),
        ],
      );
      await client.query("COMMIT");
      return { candidates: candidates.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
const worker = runWorker(spec.queue, createCollabProcessor(repository));
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

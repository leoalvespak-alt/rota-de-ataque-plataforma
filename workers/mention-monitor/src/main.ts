import { createDatabase, createPostgresHeartbeatStore } from "@plataforma/db";
import { createQueueRegistry, enqueueOnce } from "@plataforma/queue";
import { runWorker } from "@plataforma/queue/runtime";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import {
  createMentionProcessor,
  spec,
  type MentionRepository,
} from "./index.js";
const databaseUrl = process.env.DATABASE_URL,
  redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl)
  throw new Error("DATABASE_URL and REDIS_URL are required");
const { pool } = createDatabase(databaseUrl);
const registry = createQueueRegistry(redisUrl);
const repository: MentionRepository = {
  async normalize(mentionId, traceId) {
    const mention = (
      await pool.query(
        `SELECT m.*,a.id account_id FROM own_mentions m JOIN accounts a ON a.id=m.account_id WHERE m.id=$1`,
        [mentionId],
      )
    ).rows[0];
    if (!mention) return null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let lead = await client.query<{ id: string }>(
        "SELECT id FROM leads WHERE lower(username_current)=lower($1) ORDER BY last_seen_at DESC LIMIT 1",
        [mention.from_username],
      );
      if (!lead.rows[0])
        lead = await client.query<{ id: string }>(
          "INSERT INTO leads(username_current,profile_url) VALUES($1,$2) RETURNING id",
          [
            mention.from_username,
            `https://instagram.com/${mention.from_username}/`,
          ],
        );
      const leadId = lead.rows[0]!.id;
      const comment = await client.query<{ id: string }>(
        `INSERT INTO own_comments(account_id,ig_comment_id,from_username,text,commented_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(ig_comment_id) DO UPDATE SET text=EXCLUDED.text RETURNING id`,
        [
          mention.account_id,
          `mention:${mention.ig_mention_id}`,
          mention.from_username,
          mention.text,
          mention.mentioned_at,
        ],
      );
      await client.query(
        `INSERT INTO lead_interactions(lead_id,account_id,kind,direction,source,ref_type,ref_id,payload) VALUES($1,$2,'mention_received','inbound','webhook','own_mention',$3,$4)`,
        [leadId, mention.account_id, mention.id, JSON.stringify({ traceId })],
      );
      const campaignId =
        (
          await client.query<{ id: string }>(
            `SELECT id FROM campaigns WHERE status='active' ORDER BY created_at LIMIT 1`,
          )
        ).rows[0]?.id ?? "";
      await client.query("COMMIT");
      const text = String(mention.text ?? "").toLowerCase();
      return {
        mentionId: mention.id,
        commentId: comment.rows[0]!.id,
        leadId,
        campaignId,
        isQuestion: text.includes("?"),
        negative: /reclama|péssim|ruim|problema|golpe|atraso/.test(text),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async review(result) {
    await pool.query(
      `INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('mention',$1,$2,$3,$4)`,
      [
        result.mentionId,
        result.negative
          ? "Menção com possível sentimento negativo"
          : "Pergunta recebida em menção",
        JSON.stringify({ action: "reply_public" }),
        JSON.stringify({ leadId: result.leadId }),
      ],
    );
  },
};
const queue = {
  classification: (
    result: Awaited<ReturnType<MentionRepository["normalize"]>> & {},
  ) =>
    enqueueOnce(
      registry.queues.classification,
      "classification",
      ["mention", result.mentionId],
      {
        commentId: result.commentId,
        leadId: result.leadId,
        campaignId: result.campaignId,
        scope: "own",
      },
    ).then(() => undefined),
};
const worker = runWorker(spec.queue, createMentionProcessor(repository, queue));
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
process.once(
  "SIGTERM",
  () =>
    void stop()
      .finally(() => pool.end())
      .finally(() => registry.connection.quit()),
);

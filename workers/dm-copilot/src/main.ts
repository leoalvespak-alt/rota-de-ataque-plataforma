import { createDatabase, createPostgresHeartbeatStore } from "@plataforma/db";
import { humanize } from "@plataforma/humanizer";
import { MetaApiClient } from "@plataforma/meta-api";
import { HttpJsonLlmClient, LocalEmbeddingsClient } from "@plataforma/nlp";
import { runWorker } from "@plataforma/queue/runtime";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import { Redis } from "ioredis";
import {
  createDmProcessor,
  spec,
  type DmContext,
  type DmRepository,
} from "./index.js";
const databaseUrl = process.env.DATABASE_URL,
  redisUrl = process.env.REDIS_URL,
  token = process.env.META_ACCESS_TOKEN,
  embeddingEndpoint = process.env.EMBEDDINGS_ENDPOINT,
  embeddingModel = process.env.EMBEDDINGS_MODEL,
  llmModel = process.env.LLM_MODEL,
  llmEndpoint = process.env.LLM_ENDPOINT;
const provider =
  process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "openai-compatible";
if (
  !databaseUrl ||
  !redisUrl ||
  !token ||
  !embeddingEndpoint ||
  !embeddingModel ||
  !llmModel ||
  (provider !== "anthropic" && !llmEndpoint)
)
  throw new Error("DM runtime configuration is incomplete");
const { pool } = createDatabase(databaseUrl);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const embeddings = new LocalEmbeddingsClient(
  embeddingEndpoint,
  embeddingModel,
  redis,
);
await embeddings.assertDimension();
const llm = new HttpJsonLlmClient(
  llmEndpoint,
  llmModel,
  process.env.LLM_API_KEY,
  provider,
);
const api = new MetaApiClient(token, process.env.META_API_VERSION ?? "v21.0");
const repository: DmRepository = {
  async context(payload) {
    const row = (
      await pool.query(
        `SELECT t.id "threadId",$2::uuid "leadId",t.account_id "accountId",a.meta_ig_user_id "igAccountId",t.participant_ig_user_id "participantId",t.participant_username username,$3::timestamptz "inboundAt",CASE WHEN r.status='approved' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(r.suggested_action->'variants','[]'))) ELSE NULL END "approvedVariants" FROM own_dm_threads t JOIN accounts a ON a.id=t.account_id LEFT JOIN review_inbox r ON r.id=$4 WHERE t.id=$1`,
        [
          payload.threadId,
          payload.leadId,
          payload.inboundAt,
          payload.reviewId ?? null,
        ],
      )
    ).rows[0];
    if (!row) return null;
    row.history = (
      await pool.query(
        `SELECT direction,text,sent_at at FROM own_dm_messages WHERE thread_id=$1 ORDER BY sent_at DESC LIMIT 20`,
        [payload.threadId],
      )
    ).rows.reverse();
    return row;
  },
  async draft(context, variants, signature) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const draft = await client.query<{ id: string }>(
        `INSERT INTO dm_drafts(lead_id,thread_id,context,variants,trigger_kind,expires_at,humanization_signature) VALUES($1,$2,$3,$4,'inbound',$5,$6) RETURNING id`,
        [
          context.leadId,
          context.threadId,
          JSON.stringify({ history: context.history }),
          JSON.stringify(variants),
          new Date(context.inboundAt.getTime() + 24 * 3_600_000),
          signature,
        ],
      );
      const review = await client.query<{ id: string }>(
        `INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('dm_draft',$1,'Aprovação humana obrigatória',$2,$3) RETURNING id`,
        [
          draft.rows[0]!.id,
          JSON.stringify({ variants }),
          JSON.stringify({
            threadId: context.threadId,
            leadId: context.leadId,
            expiresAt: new Date(
              context.inboundAt.getTime() + 24 * 3_600_000,
            ).toISOString(),
          }),
        ],
      );
      await client.query("COMMIT");
      return review.rows[0]!.id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async sent(context, text, traceId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO own_dm_messages(thread_id,ig_message_id,direction,text,sent_at) VALUES($1,$2,'outbound',$3,now())`,
        [context.threadId, `outbound:${traceId}`, text],
      );
      await client.query(
        `UPDATE dm_drafts SET status='sent',sent_at=now() WHERE thread_id=$1 AND status='draft'`,
        [context.threadId],
      );
      await client.query(
        `INSERT INTO lead_interactions(lead_id,account_id,kind,direction,source,ref_type,ref_id,payload) VALUES($1,$2,'dm_sent','outbound','api','dm_thread',$3,$4)`,
        [
          context.leadId,
          context.accountId,
          context.threadId,
          JSON.stringify({ text, traceId }),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
const generator = {
  async variants(context: DmContext, count: number) {
    const texts: string[] = [];
    for (let index = 0; index < count; index++) {
      const output = await humanize({
        purpose: "dm_inbound",
        basePrompt:
          "Responda à mensagem inbound de forma breve, útil e natural. Não pressione por venda.",
        brandVoiceVersion: process.env.BRAND_VOICE_VERSION ?? "v1",
        context: {
          username: context.username,
          history: context.history,
          variant: index + 1,
        },
        recent: [],
        generate: async (prompt) => {
          const text = await llm.complete(prompt);
          return { text, embedding: await embeddings.embed(text) };
        },
      });
      texts.push(output.text);
    }
    return { texts, signature: process.env.BRAND_VOICE_VERSION ?? "v1" };
  },
};
const worker = runWorker(
  spec.queue,
  createDmProcessor(repository, generator, {
    send: (context, text) =>
      api.messaging
        .send(context.igAccountId, context.participantId, text)
        .then(() => undefined),
  }),
);
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
      .finally(() => redis.quit()),
);

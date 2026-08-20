import { createDatabase, createPostgresHeartbeatStore } from "@plataforma/db";
import { humanize } from "@plataforma/humanizer";
import { MetaApiClient } from "@plataforma/meta-api";
import { HttpJsonLlmClient, LocalEmbeddingsClient } from "@plataforma/nlp";
import { runWorker } from "@plataforma/queue/runtime";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import { Redis } from "ioredis";
import {
  createPrivateReplyProcessor,
  spec,
  type PrivateReplyContext,
  type PrivateReplyRepository,
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
  throw new Error("Private reply runtime configuration is incomplete");
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
const repository: PrivateReplyRepository = {
  async context(commentId, reviewId) {
    return (
      (
        await pool.query(
          `SELECT c.id "commentId",c.ig_comment_id "igCommentId",l.id "leadId",c.from_username username,c.text,cc.intent,cc.purchase_signal "purchaseSignal",cc.is_question "isQuestion",c.commented_at "createdAt",COALESCE(r.status='approved',false) approved FROM own_comments c JOIN comment_classification cc ON cc.comment_id=c.id AND cc.scope='own' JOIN leads l ON lower(l.username_current)=lower(c.from_username) LEFT JOIN review_inbox r ON r.id=$2 WHERE c.id=$1 ORDER BY l.last_seen_at DESC LIMIT 1`,
          [commentId, reviewId ?? null],
        )
      ).rows[0] ?? null
    );
  },
  async draft(context, text, embedding, signature) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const generated = await client.query<{ id: string }>(
        `INSERT INTO generated_texts(purpose,ref_type,ref_id,text,embedding,brand_voice_version) VALUES('private_reply','own_comment',$1,$2,$3::vector,$4) RETURNING id`,
        [context.commentId, text, `[${embedding.join(",")}]`, signature],
      );
      const review = await client.query<{ id: string }>(
        `INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('private_reply',$1,'Aprovação humana obrigatória',$2,$3) RETURNING id`,
        [
          context.commentId,
          JSON.stringify({ text, generatedTextId: generated.rows[0]!.id }),
          JSON.stringify({
            leadId: context.leadId,
            expiresAt: new Date(
              context.createdAt.getTime() + 7 * 86_400_000,
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
    await pool.query(`UPDATE own_comments SET replied=true WHERE id=$1`, [
      context.commentId,
    ]);
    await pool.query(
      `INSERT INTO lead_interactions(lead_id,kind,direction,source,ref_type,ref_id,payload) VALUES($1,'private_reply_sent','outbound','api','own_comment',$2,$3)`,
      [context.leadId, context.commentId, JSON.stringify({ text, traceId })],
    );
  },
};
const generator = {
  async generate(context: PrivateReplyContext) {
    const recent = (
      await pool.query(
        `SELECT id,text,embedding::text,created_at FROM generated_texts WHERE purpose='private_reply' ORDER BY created_at DESC LIMIT 50`,
      )
    ).rows.map((row) => ({
      id: row.id,
      text: row.text,
      embedding: String(row.embedding)
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number),
      purpose: "private_reply",
      createdAt: row.created_at,
    }));
    const result = await humanize({
      purpose: "private_reply",
      basePrompt:
        "Escreva uma resposta privada curta, útil e contextualizada. Não venda agressivamente.",
      brandVoiceVersion: process.env.BRAND_VOICE_VERSION ?? "v1",
      context: {
        username: context.username,
        comment: context.text,
        intent: context.intent,
      },
      recent,
      generate: async (prompt) => {
        const text = await llm.complete(prompt);
        return { text, embedding: await embeddings.embed(text) };
      },
    });
    return {
      text: result.text,
      embedding: result.embedding,
      signature: process.env.BRAND_VOICE_VERSION ?? "v1",
    };
  },
};
const worker = runWorker(
  spec.queue,
  createPrivateReplyProcessor(repository, generator, {
    send: (commentId, text) =>
      api.privateReplies.send(commentId, text).then(() => undefined),
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

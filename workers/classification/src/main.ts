import {
  createDatabase,
  createPostgresHeartbeatStore,
  loadLlmRuntimeConfig,
} from "@plataforma/db";
import { ConfigurableLlmClient, LocalEmbeddingsClient } from "@plataforma/nlp";
import { createQueueRegistry, enqueueOnce } from "@plataforma/queue";
import { runWorker } from "@plataforma/queue/runtime";
import { startWorkerHeartbeat } from "@plataforma/shared/worker";
import { Redis } from "ioredis";
import {
  createClassificationProcessor,
  spec,
  type ClassificationRepository,
} from "./index.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const embeddingsEndpoint = process.env.EMBEDDINGS_ENDPOINT;
const embeddingsModel = process.env.EMBEDDINGS_MODEL;
if (!databaseUrl || !redisUrl || !embeddingsEndpoint || !embeddingsModel)
  throw new Error("Classification runtime configuration is incomplete");

const { pool } = createDatabase(databaseUrl);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const registry = createQueueRegistry(redisUrl);
const embeddings = new LocalEmbeddingsClient(
  embeddingsEndpoint,
  embeddingsModel,
  redis,
);
await embeddings.assertDimension();
const llm = new ConfigurableLlmClient(() => loadLlmRuntimeConfig(pool));

const repository: ClassificationRepository = {
  async comment(scope, id) {
    const table = scope === "own" ? "own_comments" : "comments";
    const result = await pool.query<{ text: string }>(
      `SELECT text FROM ${table} WHERE id=$1`,
      [id],
    );
    return result.rows[0] ?? null;
  },
  async save(id, scope, classification, embedding) {
    await pool.query(
      `INSERT INTO comment_classification(comment_id,scope,intent,topic,sentiment,purchase_signal,is_question,pain_point,confidence,embedding,classified_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector,now())
      ON CONFLICT(comment_id,scope) DO UPDATE SET intent=EXCLUDED.intent,topic=EXCLUDED.topic,sentiment=EXCLUDED.sentiment,purchase_signal=EXCLUDED.purchase_signal,is_question=EXCLUDED.is_question,pain_point=EXCLUDED.pain_point,confidence=EXCLUDED.confidence,embedding=EXCLUDED.embedding,classified_at=now()`,
      [
        id,
        scope,
        classification.intent,
        classification.topic,
        classification.sentiment,
        classification.purchase_signal,
        classification.is_question,
        classification.pain_point,
        classification.confidence,
        `[${embedding.join(",")}]`,
      ],
    );
  },
};
const queue = {
  scoring: (leadId: string, campaignId: string) =>
    enqueueOnce(
      registry.queues.scoring,
      "scoring",
      [leadId, campaignId, "classification"],
      { leadId, campaignId, trigger: "classification" },
    ).then(() => undefined),
  privateReply: (commentId: string) =>
    enqueueOnce(
      registry.queues["private-reply"],
      "private-reply",
      ["comment", commentId],
      { commentId, accountRole: "actor", synthetic: false },
    ).then(() => undefined),
};
const worker = runWorker(
  spec.queue,
  createClassificationProcessor(repository, queue, {
    embed: (text) => embeddings.embed(text),
    complete: (prompt) => llm.complete(prompt),
  }),
);
const stopHeartbeat = startWorkerHeartbeat(
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
    void stopHeartbeat()
      .finally(() => pool.end())
      .finally(() => redis.quit())
      .finally(() => registry.connection.quit()),
);

import { createDatabase } from '@plataforma/db'
import { HttpJsonLlmClient, LocalEmbeddingsClient } from '@plataforma/nlp'
import { runWorker } from '@plataforma/queue/runtime'
import { Redis } from 'ioredis'
import { createCompetitiveIntelProcessor, spec, type CompetitiveRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
const embeddingsEndpoint = process.env.EMBEDDINGS_ENDPOINT
const embeddingsModel = process.env.EMBEDDINGS_MODEL
const llmEndpoint = process.env.LLM_ENDPOINT
const llmModel = process.env.LLM_MODEL
if (!databaseUrl || !redisUrl || !embeddingsEndpoint || !embeddingsModel || !llmEndpoint || !llmModel) {
  throw new Error('Competitive intelligence runtime configuration is incomplete')
}
const { pool } = createDatabase(databaseUrl)
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null })
const embeddings = new LocalEmbeddingsClient(embeddingsEndpoint, embeddingsModel, redis)
await embeddings.assertDimension()
const llm = new HttpJsonLlmClient(llmEndpoint, llmModel, process.env.LLM_API_KEY)

const repository: CompetitiveRepository = {
  async documents(payload) {
    const days = payload.windowDays ?? 30
    const result = await pool.query<{ competitor_id: string; text: string; source_id: string }>(
      `SELECT post.competitor_id, concat_ws(E'\n', post.caption, string_agg(comment.text, E'\n')) text, post.id::text source_id
       FROM posts post
       LEFT JOIN comments comment ON comment.post_id = post.id
       WHERE post.posted_at >= now() - ($1 || ' days')::interval
         AND ($2::uuid IS NULL OR post.competitor_id = $2)
       GROUP BY post.id, post.competitor_id, post.caption
       HAVING length(concat_ws(E'\n', post.caption, string_agg(comment.text, E'\n'))) > 8`,
      [days, payload.competitorId ?? null],
    )
    return result.rows.map((row) => ({ competitorId: row.competitor_id, text: row.text, sourceId: row.source_id }))
  },
  async persist(document, classification, embedding) {
    const topic = await pool.query<{ id: string }>(
      `SELECT id FROM topics WHERE competitor_id = $1 AND lower(label) = lower($2) ORDER BY last_seen_at DESC LIMIT 1`,
      [document.competitorId, classification.topic],
    )
    const topicId = topic.rows[0]?.id ?? (await pool.query<{ id: string }>(
      `INSERT INTO topics(scope, competitor_id, label, embedding, momentum_7d, momentum_30d)
       VALUES('competitive', $1, $2, $3::vector, 0, 0) RETURNING id`,
      [document.competitorId, classification.topic, `[${embedding.join(',')}]`],
    )).rows[0]!.id
    await pool.query('UPDATE topics SET last_seen_at = now(), momentum_7d = momentum_7d + 1, momentum_30d = momentum_30d + 1 WHERE id = $1', [topicId])
    if (classification.pain_point) {
      await pool.query(`INSERT INTO pain_points(topic_id, label, evidence, weight) VALUES($1, $2, $3::jsonb, 1)`, [topicId, classification.pain_point, JSON.stringify({ sourceId: document.sourceId, intent: classification.intent })])
    }
    if (classification.is_question) {
      await pool.query(`INSERT INTO questions(topic_id, text, frequency) VALUES($1, $2, 1)`, [topicId, document.text.slice(0, 1000)])
    }
  },
  async refreshTrends() { await pool.query('REFRESH MATERIALIZED VIEW mv_topic_trends') },
}

runWorker(spec.queue, createCompetitiveIntelProcessor(repository, { embed: (text) => embeddings.embed(text), complete: (prompt) => llm.complete(prompt) }))

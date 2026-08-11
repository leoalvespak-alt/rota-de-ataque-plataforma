import { createDatabase } from '@plataforma/db'
import { humanize } from '@plataforma/humanizer'
import { HttpJsonLlmClient, LocalEmbeddingsClient } from '@plataforma/nlp'
import { runWorker } from '@plataforma/queue/runtime'
import { Redis } from 'ioredis'
import { createThreadsAdapter, spec, threadsPrompt, type ThreadsAdapterRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
const embeddingEndpoint = process.env.EMBEDDINGS_ENDPOINT
const embeddingModel = process.env.EMBEDDINGS_MODEL
const llmModel = process.env.LLM_MODEL
const llmEndpoint = process.env.LLM_ENDPOINT
const provider = process.env.LLM_PROVIDER === 'anthropic' ? 'anthropic' : 'openai-compatible'
if (!databaseUrl || !redisUrl || !embeddingEndpoint || !embeddingModel || !llmModel || (provider !== 'anthropic' && !llmEndpoint)) throw new Error('Threads runtime configuration is incomplete')
const { pool } = createDatabase(databaseUrl)
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null })
const embeddings = new LocalEmbeddingsClient(embeddingEndpoint, embeddingModel, redis)
await embeddings.assertDimension()
const llm = new HttpJsonLlmClient(llmEndpoint, llmModel, process.env.LLM_API_KEY, provider)

const repository: ThreadsAdapterRepository = {
  async get(id) { const result = await pool.query<{ id: string; campaign_id: string; angle: string; hook: string; arguments: unknown; brand_voice_version: string }>('SELECT id,campaign_id,angle,hook,arguments,brand_voice_version FROM content_items WHERE id=$1', [id]); const row = result.rows[0]; return row ? { id: row.id, campaignId: row.campaign_id, angle: row.angle, hook: row.hook, arguments: row.arguments, brandVoiceVersion: row.brand_voice_version } : null },
  async recentTexts(campaignId) { return (await pool.query<{ text: string }>(`SELECT payload->>'text' text FROM content_variants variant JOIN content_items item ON item.id=variant.content_item_id WHERE item.campaign_id=$1 AND variant.channel='threads' AND item.created_at > now()-interval '30 days' LIMIT 50`, [campaignId])).rows.map((row) => row.text) },
  async save(itemId, text) { return (await pool.query<{ id: string }>(`INSERT INTO content_variants(content_item_id,channel,format,payload,status,generated_by) VALUES($1,'threads','text',$2::jsonb,'ready','llm') ON CONFLICT(content_item_id,channel,format) DO UPDATE SET payload=EXCLUDED.payload,status='ready' RETURNING id`, [itemId, JSON.stringify({ text })])).rows[0]!.id },
  async createReview(variantId, traceId, violations = []) { await pool.query(`INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('content_variant',$1,$2,$3::jsonb,$4::jsonb)`, [variantId, violations.length ? 'Threads variant requires revision' : 'Threads publication needs human approval', JSON.stringify({ action: 'approve_threads_variant', violations }), JSON.stringify({ traceId })]) }
}

const humanizeThreads = async (item: Parameters<typeof threadsPrompt>[0], recent: string[]) => {
  const result = await humanize({ channel: 'threads', purpose: 'threads_post', contentItemId: item.id, basePrompt: threadsPrompt(item), brandVoiceVersion: item.brandVoiceVersion, context: { item }, recent: [], generate: async (prompt) => { const text = await llm.complete(`${prompt}\nEvite repetir estes posts recentes: ${recent.join('\n---\n')}`); return { text, embedding: await embeddings.embed(text) } } })
  return { text: result.text, ok: result.ok, violations: result.violations }
}

runWorker(spec.queue, createThreadsAdapter(repository, async (prompt) => llm.complete(prompt), humanizeThreads))

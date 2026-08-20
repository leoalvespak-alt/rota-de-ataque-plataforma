import { createDatabase, loadLlmRuntimeConfig } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { logger } from '@plataforma/shared'
import { processNewsRadar, type Repository, type AiClassifier, type NewsSource } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repo: Repository = {
  async getActiveSources() {
    const result = await pool.query<NewsSource>(
      'SELECT id, name, url, feed_url, source_type, portal, active, etag, last_modified, failure_count FROM news_sources WHERE active = true ORDER BY last_fetched_at ASC NULLS FIRST'
    )
    return result.rows
  },

  async upsertNewsItem(item) {
    const result = await pool.query(
      `INSERT INTO news_items (source_id, external_id, url, url_hash, title, summary, content, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
       ON CONFLICT (source_id, external_id) DO NOTHING
       RETURNING id`,
      [item.source_id, item.external_id, item.url, item.url_hash, item.title, item.summary, item.content, item.published_at]
    )
    return { id: result.rows[0]?.id ?? '', isNew: (result.rowCount ?? 0) > 0 }
  },

  async markSourceFetched(sourceId, etag, lastModified) {
    await pool.query(
      'UPDATE news_sources SET last_fetched_at = now(), etag = COALESCE($2, etag), last_modified = COALESCE($3, last_modified), failure_count = 0, updated_at = now() WHERE id = $1',
      [sourceId, etag, lastModified]
    )
  },

  async incrementSourceFailure(sourceId, error) {
    await pool.query(
      'UPDATE news_sources SET failure_count = failure_count + 1, last_failure_at = now(), updated_at = now() WHERE id = $1',
      [sourceId]
    )
    logger.warn({ sourceId, error }, 'news source fetch failed')
  },

  async disableSource(sourceId, reason) {
    await pool.query(
      'UPDATE news_sources SET active = false, disabled_reason = $2, updated_at = now() WHERE id = $1',
      [sourceId, reason]
    )
    logger.error({ sourceId, reason }, 'news source auto-disabled')
  },

  async getUnclassifiedItems(limit) {
    const result = await pool.query(
      `SELECT ni.id, ni.title, ni.summary, ni.content, ni.url, ns.name AS source_name
       FROM news_items ni JOIN news_sources ns ON ns.id = ni.source_id
       WHERE ni.classified = false ORDER BY ni.fetched_at ASC LIMIT $1`,
      [limit]
    )
    return result.rows
  },

  async markItemClassified(itemId, classification) {
    await pool.query(
      'UPDATE news_items SET classified = true, classification = $2 WHERE id = $1',
      [itemId, JSON.stringify(classification)]
    )
  },

  async insertRadarFinding(finding) {
    const result = await pool.query(
      `INSERT INTO radar_findings (news_item_id, title, summary, source_url, source_name, concurso_alvo, estado, banca, fase_ciclo, relevance_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [finding.news_item_id, finding.title, finding.summary, finding.source_url, finding.source_name, finding.concurso_alvo, finding.estado, finding.banca, finding.fase_ciclo, finding.relevance_score]
    )
    return result.rows[0].id
  },
}

let aiClassifier: AiClassifier | null = null

async function initAi(): Promise<AiClassifier | null> {
  try {
    const config = await loadLlmRuntimeConfig(pool)
    return {
      async classify(title, content) {
        const prompt = `Classify this news article about Brazilian civil service exams (concursos).
Title: ${title}
Content: ${(content ?? '').slice(0, 500)}

Return JSON with:
- concurso_alvo: PM, PP, PC, PF, PRF, GCM, or null
- estado: Brazilian state abbreviation or null
- banca: exam board name or null
- fase_ciclo: autorizacao, comissao, banca_definida, edital_publicado, retificacao, resultado, or null
- relevance_score: 0.0 to 1.0 (how relevant for police exam candidates)
- is_police_relevant: boolean`

        const body: Record<string, unknown> = {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config.maxOutputTokens,
          temperature: 0,
          response_format: { type: 'json_object' },
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

        const endpoint = config.provider === 'anthropic'
          ? 'https://api.anthropic.com/v1/messages'
          : `${config.endpoint}/chat/completions`

        if (config.provider === 'anthropic') {
          headers['x-api-key'] = config.apiKey ?? ''
          headers['anthropic-version'] = '2023-06-01'
          body.max_tokens = config.maxOutputTokens
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        })

        const data = await response.json()
        const text = config.provider === 'anthropic'
          ? data.content?.[0]?.text
          : data.choices?.[0]?.message?.content

        return JSON.parse(text)
      },
    }
  } catch {
    logger.info('AI classifier not available, using keyword fallback')
    return null
  }
}

runWorker('news-radar', async (job) => {
  if (!aiClassifier) aiClassifier = await initAi()

  const mode = (job.payload as { mode?: string }).mode === 'full' ? 'full' : 'incremental'
  const result = await processNewsRadar({ repo, ai: aiClassifier }, mode as 'incremental' | 'full')

  logger.info({ ...result, mode }, 'news-radar run complete')

  return {
    ok: true,
    traceId: job.id,
    event: { kind: 'news-radar.completed', payload: result },
  }
})

import { loadLlmRuntimeConfig } from '@plataforma/db'
import { logger, reportIaUsage } from '@plataforma/shared'
import type { Pool } from 'pg'
import type { TaskHandler } from '@plataforma/task-runtime'
import { processNewsRadar, type Repository, type AiClassifier, type NewsSource } from './index.js'
import { persistNewsClassification } from './persistence.js'
import { classifyWithFallback } from './llm-classifier.js'

export function createNewsRadarTaskHandler(pool: Pool): TaskHandler {
  const repo: Repository = {
  async getActiveSources() {
    const result = await pool.query<NewsSource>(
      'SELECT id, name, url, feed_url, source_type, portal, active, etag, last_modified, failure_count, last_fetched_at, pagination_cursor, pagination_complete FROM news_sources WHERE active = true ORDER BY last_fetched_at ASC NULLS FIRST'
    )
    return result.rows
  },

  async upsertNewsItem(item) {
    let existing = await pool.query<{ id: string }>(
      `SELECT id FROM public.news_items WHERE url_hash = $1 OR (source_id = $2 AND external_id = $3)
       ORDER BY CASE WHEN url_hash = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [item.url_hash, item.source_id, item.external_id],
    )
    let id = existing.rows[0]?.id
    let isNew = false
    if (!id) {
      const inserted = await pool.query<{ id: string }>(
      `INSERT INTO news_items (source_id, external_id, url, url_hash, title, summary, content, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
       ON CONFLICT (source_id, external_id) DO NOTHING
       RETURNING id`,
      [item.source_id, item.external_id, item.url, item.url_hash, item.title, item.summary, item.content, item.published_at]
      )
      id = inserted.rows[0]?.id
      isNew = (inserted.rowCount ?? 0) > 0
      if (!id) {
        existing = await pool.query<{ id: string }>(
          'SELECT id FROM public.news_items WHERE url_hash = $1 OR (source_id = $2 AND external_id = $3) LIMIT 1',
          [item.url_hash, item.source_id, item.external_id],
        )
        id = existing.rows[0]?.id
      }
    }
    if (!id) throw new Error('News item could not be located after insert')

    const detailState = await pool.query<{
      should_fetch: boolean
      etag: string | null
      last_modified: string | null
    }>(
      `SELECT
         CASE
           WHEN ni.details_checked_at IS NULL OR ni.details_http_status IS NULL THEN true
           WHEN ni.details_http_status IN (0, 408, 425, 429, 500, 502, 503, 504)
             THEN ni.details_checked_at < now() - interval '6 hours'
           WHEN ni.details_http_status IN (200, 304)
             THEN ni.details_checked_at < now() - CASE WHEN ni.content IS NULL THEN interval '7 days' ELSE interval '30 days' END
           WHEN ni.details_http_status IN (404, 410)
             THEN ni.details_checked_at < now() - interval '30 days'
           ELSE ni.details_checked_at < now() - interval '7 days'
         END AS should_fetch,
         version.etag,
         version.last_modified
       FROM public.news_items ni
       LEFT JOIN LATERAL (
         SELECT etag, last_modified
         FROM editorial.news_item_versions
         WHERE news_item_id = ni.id
         ORDER BY last_checked_at DESC, id DESC
         LIMIT 1
       ) version ON true
       WHERE ni.id = $1::uuid`,
      [id],
    )
    return {
      id,
      isNew,
      articleDetails: detailState.rows[0]?.should_fetch ? {
        url: item.url,
        title: item.title,
        etag: detailState.rows[0]?.etag ?? null,
        lastModified: detailState.rows[0]?.last_modified ?? null,
      } : null,
    }
  },

  async saveArticleDetails(itemId, result) {
    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true
      const current = await client.query<{
        title: string
        summary: string | null
        url: string
        content: string | null
        published_at: Date | string | null
      }>('SELECT title, summary, url, content, published_at FROM public.news_items WHERE id = $1::uuid FOR UPDATE', [itemId])
      const row = current.rows[0]
      if (!row) throw new Error(`News item ${itemId} was not found for article details`)

      const nextTitle = result.details.title?.trim() || row.title
      const nextContent = result.details.content ?? row.content
      const nextPublishedAt = result.details.publishedAt ?? row.published_at
      const currentPublishedAt = row.published_at ? new Date(row.published_at).getTime() : null
      const nextPublishedAtMs = nextPublishedAt ? new Date(nextPublishedAt).getTime() : null
      const changed = nextTitle !== row.title || nextContent !== row.content || nextPublishedAtMs !== currentPublishedAt

      await client.query(
        `INSERT INTO editorial.news_item_versions(
           news_item_id, content_hash, parser_version, response_status, last_http_status,
           title, published_at, content, attachments, etag, last_modified
         ) VALUES ($1::uuid, $2, $3, $4, $4, $5, $6::timestamptz, $7, $8::jsonb, $9, $10)
         ON CONFLICT (news_item_id, content_hash) DO UPDATE SET
           last_http_status = EXCLUDED.last_http_status,
           title = EXCLUDED.title,
           published_at = EXCLUDED.published_at,
           content = EXCLUDED.content,
           attachments = EXCLUDED.attachments,
           etag = COALESCE(EXCLUDED.etag, editorial.news_item_versions.etag),
           last_modified = COALESCE(EXCLUDED.last_modified, editorial.news_item_versions.last_modified),
           last_seen_at = now(),
           last_checked_at = now()`,
        [itemId, result.contentHash, result.parserVersion, result.status, result.details.title, result.details.publishedAt, result.details.content, JSON.stringify(result.details.attachments), result.etag, result.lastModified],
      )
      await client.query(
        `UPDATE public.news_items SET
           title = $2,
           published_at = $3::timestamptz,
           content = $4,
           details_checked_at = now(),
           details_http_status = $5,
           classified = CASE WHEN $6 THEN false ELSE classified END,
           classification = CASE WHEN $6 THEN NULL ELSE classification END
         WHERE id = $1::uuid`,
        [itemId, nextTitle, nextPublishedAt, nextContent, result.status, changed],
      )
      if (changed) {
        await client.query(
          `UPDATE public.radar_findings
           SET title = $2, summary = COALESCE($3, summary), source_url = $4
           WHERE news_item_id = $1::uuid AND review_status = 'review' AND auto_content_allowed = false`,
          [itemId, nextTitle, row.summary, row.url],
        )
      }
      await client.query('COMMIT')
      transactionStarted = false
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  },

  async markArticleDetailsAttempt(itemId, status) {
    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true
      await client.query(
        'UPDATE public.news_items SET details_checked_at = now(), details_http_status = $2 WHERE id = $1::uuid',
        [itemId, status],
      )
      if (status === 304) {
        await client.query(
          `UPDATE editorial.news_item_versions
           SET last_http_status = 304, last_seen_at = now(), last_checked_at = now()
           WHERE id = (
             SELECT id FROM editorial.news_item_versions WHERE news_item_id = $1::uuid
             ORDER BY last_checked_at DESC, id DESC LIMIT 1
           )`,
          [itemId],
        )
      }
      await client.query('COMMIT')
      transactionStarted = false
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  },

  async markSourceFetched(sourceId, etag, lastModified, paginationCursor, paginationComplete) {
    await pool.query(
      'UPDATE news_sources SET last_fetched_at = now(), etag = COALESCE($2, etag), last_modified = COALESCE($3, last_modified), pagination_cursor = $4, pagination_complete = $5, failure_count = 0, updated_at = now() WHERE id = $1',
      [sourceId, etag, lastModified, paginationCursor, paginationComplete]
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
       WHERE ni.classified = false
         AND ni.published_at >= now() - interval '30 days'
       ORDER BY ni.published_at DESC, ni.fetched_at DESC LIMIT $1`,
      [limit]
    )
    return result.rows
  },

  async persistClassification(itemId, classification, finding) {
    return persistNewsClassification(pool, itemId, classification, finding)
  },

  }

  let aiClassifier: AiClassifier | null = null

  async function initAi(): Promise<AiClassifier | null> {
  if (process.env.RADAR_DEEPSEEK_ENABLED !== 'true') {
    logger.info('DeepSeek radar classifier disabled; deterministic review gate is active')
    return null
  }
  try {
    const config = await loadLlmRuntimeConfig(pool)
    return {
      async classify(title, content, signal) {
        const startedAt = Date.now()
        const prompt = `You are the safety classifier for a Brazilian public-security civil-service-exam radar. Classify only the supplied text; do not invent facts.
Title: ${title}
Content: ${(content ?? '').slice(0, 500)}

 Return exactly one JSON object. Use null where a value is unknown; keep reason to one short Portuguese sentence of no more than 20 words. Never use the em dash character (—); use commas or colons instead. Example shape (replace these example values with the classification of the supplied text):
{"concurso_alvo":"PM","categoria":"PM","estado":"MG","banca":null,"fase_ciclo":"edital_publicado","relevance_score":0.9,"confidence":0.9,"factuality_score":0.8,"is_police_relevant":true,"is_duplicate":false,"reason":"Edital policial publicado em Minas Gerais."}
The JSON object must contain:
- concurso_alvo: PM, PP, PC, PF, PRF, GCM, or "outro"/null
- categoria: PM, PP, PC, PF, PRF, GCM, BOMBEIROS, TRANSITO, SOCIOEDUCATIVO, or outro
- estado: Brazilian state abbreviation or null
- banca: exam board name or null
- fase_ciclo: autorizacao, comissao, banca_definida, edital_publicado, retificacao, resultado, or null
- relevance_score: 0.0 to 1.0 (how relevant for police exam candidates)
- confidence: 0.0 to 1.0 (confidence in the classification)
- factuality_score: 0.0 to 1.0 (whether the claim is concrete and attributable)
- is_police_relevant: boolean
- is_duplicate: boolean
- reason: short Portuguese explanation`

        try {
          const primaryEndpoint = config.provider === 'anthropic'
            ? 'https://api.anthropic.com/v1/messages'
            : `${config.endpoint}/chat/completions`
          const result = await classifyWithFallback({
            prompt,
            primary: {
              provider: config.provider,
              endpoint: primaryEndpoint,
              model: process.env.RADAR_DEEPSEEK_MODEL?.trim() || config.model,
              apiKey: config.apiKey,
            },
            fallback: process.env.OPENROUTER_API_KEY?.trim() ? {
              provider: 'openrouter',
              endpoint: 'https://openrouter.ai/api/v1/chat/completions',
              model: process.env.RADAR_GLM_FALLBACK_MODEL?.trim() || 'z-ai/glm-5.3-flash',
              apiKey: process.env.OPENROUTER_API_KEY.trim(),
            } : undefined,
            maxTokens: Math.max(config.maxOutputTokens, 1024),
            signal,
          })
          reportIaUsage({ feature: 'prospector_news_radar', provider: result.provider, model: result.model, input_tokens: result.inputTokens, output_tokens: result.outputTokens, latency_ms: Date.now() - startedAt, success: true })
          return result.value
        } catch (error) {
          reportIaUsage({ feature: 'prospector_news_radar', provider: config.provider, model: process.env.RADAR_DEEPSEEK_MODEL?.trim() || config.model, latency_ms: Date.now() - startedAt, success: false, error_code: error instanceof Error ? error.name : 'unknown' })
          throw error
        }
      },
    }
  } catch {
    logger.info('AI classifier not available; unclassified items remain pending')
    return null
  }
  }

  return async (request, context) => {
    if (!aiClassifier) aiClassifier = await initAi()

    const payload = request.payload as { mode?: string; classificationOnly?: boolean }
    const mode = payload.classificationOnly === true
      ? 'classification-only'
      : payload.mode === 'full' ? 'full' : 'incremental'
    const result = await processNewsRadar({
      repo,
      ai: aiClassifier,
      signal: context.signal,
      checkpoint: context.checkpoint,
      onCheckpoint: context.saveCheckpoint,
    }, mode)

    logger.info({ ...result, mode, runId: context.runId, attempt: context.attempt }, 'news-radar run complete')

    return {
      result: { ok: true, ...result, mode },
      events: [{
        eventKey: `${request.idempotencyKey}:news-radar.completed`,
        eventType: 'news-radar.completed',
        payload: { runId: context.runId, ...result, mode },
      }],
    }
  }
}

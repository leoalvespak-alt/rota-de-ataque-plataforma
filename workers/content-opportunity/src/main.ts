import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createContentOpportunity, createContentOpportunityProcessor, spec, type ContentOpportunityRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: ContentOpportunityRepository = {
  async signals(payload) {
    const result = await pool.query<{
      topic: string; pain_point: string | null; question: string | null; momentum: number; evidence: Record<string, unknown>
    }>(
      `WITH topic_signals AS (
       SELECT topic.label topic,
              max(pain.label) pain_point,
              max(question.text) question,
              greatest(COALESCE(topic.momentum_7d, 0), COALESCE(topic.momentum_30d, 0)) momentum,
              jsonb_build_object('topic_id', topic.id, 'momentum_7d', topic.momentum_7d, 'momentum_30d', topic.momentum_30d) evidence
       FROM topics topic
       LEFT JOIN pain_points pain ON pain.topic_id = topic.id
       LEFT JOIN questions question ON question.topic_id = topic.id
       WHERE NOT EXISTS (
         SELECT 1 FROM content_opportunities existing
         WHERE existing.campaign_id = $1 AND existing.thesis ILIKE '%' || topic.label || '%'
       )
       GROUP BY topic.id, topic.label, topic.momentum_7d, topic.momentum_30d
       ), organic_signals AS (
         SELECT COALESCE(observation.title,regexp_replace(observation.canonical_url,'^https?://([^/]+).*','\\1')) topic,
           NULL::text pain_point,NULL::text question,
           LEAST(100,GREATEST(0,50+(signal.value->>'score')::numeric*10)) momentum,
           jsonb_build_object('observation_id',observation.id,'signal_id',signal.id,'url',observation.canonical_url,'platform',observation.platform,'confidence',signal.confidence,'references',jsonb_build_array(jsonb_build_object('label',COALESCE(observation.title,observation.platform),'url',observation.canonical_url))) evidence
         FROM organic_intelligence_signals signal JOIN provider_observations observation ON observation.id=signal.observation_id
         JOIN research_runs run ON run.id=observation.research_run_id
         WHERE run.campaign_id=$1 AND signal.signal_type='relative_outlier'
           AND NOT EXISTS(SELECT 1 FROM content_opportunities existing WHERE existing.campaign_id=$1 AND existing.source_references @> jsonb_build_array(jsonb_build_object('url',observation.canonical_url)))
       )
       SELECT * FROM (SELECT * FROM topic_signals UNION ALL SELECT * FROM organic_signals) combined
       ORDER BY momentum DESC
       LIMIT $2`,
      [payload.campaignId, payload.limit ?? 25],
    )
    return result.rows.map((row) => ({ topic: row.topic, painPoint: row.pain_point ?? undefined, question: row.question ?? undefined, momentum: Number(row.momentum), evidence: row.evidence }))
  },
  async save(payload, signal) {
    const opportunity = createContentOpportunity(signal)
    await pool.query(
      `INSERT INTO content_opportunities(campaign_id, thesis, angle, hook, evidence, opportunity_score, score_components, score_version, confidence, source_references, status)
       VALUES($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10::jsonb, 'new')`,
      [payload.campaignId, opportunity.thesis, opportunity.angle, opportunity.hook, JSON.stringify(opportunity.evidence), opportunity.score.total, JSON.stringify(opportunity.score.components), opportunity.score.version, opportunity.score.components.confidence, JSON.stringify(opportunity.evidence.references ?? [])],
    )
  },
}

runWorker(spec.queue, createContentOpportunityProcessor(repository))

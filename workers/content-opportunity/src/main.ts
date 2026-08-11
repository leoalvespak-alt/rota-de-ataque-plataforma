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
      `SELECT topic.label topic,
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
       ORDER BY greatest(COALESCE(topic.momentum_7d, 0), COALESCE(topic.momentum_30d, 0)) DESC
       LIMIT $2`,
      [payload.campaignId, payload.limit ?? 25],
    )
    return result.rows.map((row) => ({ topic: row.topic, painPoint: row.pain_point ?? undefined, question: row.question ?? undefined, momentum: Number(row.momentum), evidence: row.evidence }))
  },
  async save(payload, signal) {
    const opportunity = createContentOpportunity(signal)
    await pool.query(
      `INSERT INTO content_opportunities(campaign_id, thesis, angle, hook, evidence, opportunity_score, status)
       VALUES($1, $2, $3, $4, $5::jsonb, $6, 'new')`,
      [payload.campaignId, opportunity.thesis, opportunity.angle, opportunity.hook, JSON.stringify(opportunity.evidence), opportunity.score],
    )
  },
}

runWorker(spec.queue, createContentOpportunityProcessor(repository))

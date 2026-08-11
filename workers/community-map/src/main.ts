import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createCommunityMapProcessor, spec, type CommunityRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: CommunityRepository = {
  async edges(payload) {
    const result = await pool.query<{
      lead_id: string; context_type: string; context_id: string; weight: number; username: string
    }>(
      `SELECT source.lead_id, 'competitor' context_type, source.competitor_id::text context_id,
              SUM(COALESCE(campaign_competitor.weight, 1))::numeric weight, lead.username_current username
       FROM lead_sources source
       JOIN leads lead ON lead.id = source.lead_id
       LEFT JOIN campaign_competitors campaign_competitor
         ON campaign_competitor.campaign_id = source.campaign_id AND campaign_competitor.competitor_id = source.competitor_id
       WHERE source.campaign_id = $1 AND source.competitor_id IS NOT NULL
       GROUP BY source.lead_id, source.competitor_id, lead.username_current
       UNION ALL
       SELECT interaction.lead_id, 'topic' context_type, classification.topic context_id,
              count(*)::numeric weight, lead.username_current username
       FROM lead_interactions interaction
       JOIN leads lead ON lead.id = interaction.lead_id
       JOIN lead_sources source ON source.lead_id = interaction.lead_id AND source.campaign_id = $1
       JOIN comments comment ON comment.id = source.comment_id
       JOIN comment_classification classification ON classification.comment_id = comment.id AND classification.scope = 'competitor'
       WHERE classification.topic IS NOT NULL
       GROUP BY interaction.lead_id, classification.topic, lead.username_current`,
      [payload.campaignId],
    )
    return result.rows.map((row) => ({ leadId: row.lead_id, contextType: row.context_type, contextId: row.context_id, weight: Number(row.weight), username: row.username }))
  },
  async replace(payload, groups, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const group of groups) {
        const label = `${group[0]!.contextType}:${group[0]!.contextId}`
        const community = await client.query<{ id: string }>(
          `INSERT INTO communities(name, size, cohesion_score, detected_at, last_refreshed_at)
           VALUES($1, $2, $3, now(), now()) RETURNING id`,
          [label, new Set(group.map((edge) => edge.leadId)).size, group.reduce((sum, edge) => sum + edge.weight, 0) / group.length],
        )
        for (const edge of group) {
          await client.query(
            `INSERT INTO community_edges(from_lead_id, to_context_type, to_context_id, weight, last_reinforced_at)
             VALUES($1, $2, $3, $4, now())
             ON CONFLICT(from_lead_id, to_context_type, to_context_id)
             DO UPDATE SET weight = EXCLUDED.weight, last_reinforced_at = now()`,
            [edge.leadId, edge.contextType, edge.contextId, edge.weight],
          )
          await client.query(
            `INSERT INTO lead_community_membership(lead_id, community_id, membership_strength)
             VALUES($1, $2, $3) ON CONFLICT(lead_id, community_id) DO UPDATE SET membership_strength = EXCLUDED.membership_strength`,
            [edge.leadId, community.rows[0]!.id, edge.weight],
          )
          if (edge.contextType === 'competitor' && edge.username) {
            await client.query(
              `INSERT INTO competitor_candidates(username_candidate, discovery_reason, overlap_score, status)
               VALUES($1, $2, $3, 'new')`,
              [edge.username, `community_map trace=${traceId}`, edge.weight],
            )
          }
        }
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

runWorker(spec.queue, createCommunityMapProcessor(repository))

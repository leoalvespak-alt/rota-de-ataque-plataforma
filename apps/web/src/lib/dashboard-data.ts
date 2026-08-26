import { createDatabase } from '@plataforma/db'
import { z } from 'zod'
import { getCampaignContext } from './campaign-context'

export const DashboardViewSchema = z.enum(['overview', 'radar', 'competitive-intel', 'content-opportunity', 'community', 'conversations', 'timeline', 'identities', 'email-flows', 'contact-policies', 'source-roi', 'configs'])
export type DashboardView = z.infer<typeof DashboardViewSchema>

export const conversationsQuery = `SELECT * FROM (
              SELECT thread.id,'instagram' channel,account.username account,thread.participant_username participant,thread.unread_count,thread.last_message_at,state.current_stage stage,state.detected_intent,state.requires_human_review,NULL::timestamptz session_window_expires_at,NULL::jsonb optin_evidence
              FROM own_dm_threads thread JOIN accounts account ON account.id=thread.account_id LEFT JOIN conversation_state state ON state.thread_id=thread.id
              WHERE $1::uuid IS NULL OR EXISTS(SELECT 1 FROM leads lead JOIN lead_scores score ON score.lead_id=lead.id WHERE score.campaign_id=$1 AND lead.username_current=thread.participant_username)
              UNION ALL
              SELECT conversation.id,'whatsapp' channel,NULL account,identity.external_handle participant,0 unread_count,COALESCE(conversation.last_inbound_at,conversation.last_outbound_at) last_message_at,conversation.stage,NULL detected_intent,conversation.requires_human_review,conversation.session_window_expires_at,optin.evidence optin_evidence
              FROM whatsapp_conversations conversation LEFT JOIN whatsapp_optins optin ON optin.id=conversation.optin_id LEFT JOIN identities identity ON identity.lead_id=conversation.lead_id AND identity.channel='whatsapp'
              WHERE conversation.stage <> 'cooled' AND ($1::uuid IS NULL OR EXISTS(SELECT 1 FROM lead_scores score WHERE score.lead_id=conversation.lead_id AND score.campaign_id=$1))
              ) conversations ORDER BY last_message_at DESC NULLS LAST LIMIT 200`

const queries: Record<DashboardView, string> = {
  overview: `SELECT campaign_id,name,leads,conversions,completed_actions,recommendations FROM mv_campaign_performance WHERE ($1::uuid IS NULL OR campaign_id=$1) ORDER BY name`,
  radar: `SELECT radar.post_id id,radar.opportunity_score,radar.velocity,radar.new_leads,radar.avg_intent,post.post_url,competitor.username competitor
          FROM post_radar radar JOIN posts post ON post.id=radar.post_id JOIN competitors competitor ON competitor.id=post.competitor_id
          JOIN campaign_competitors link ON link.competitor_id=competitor.id
          WHERE ($1::uuid IS NULL OR link.campaign_id=$1) ORDER BY radar.opportunity_score DESC NULLS LAST LIMIT 200`,
  'competitive-intel': `SELECT topic.id,topic.label topic,competitor.username competitor,topic.momentum_7d,topic.momentum_30d,
                         count(DISTINCT pain.id)::int pain_points,count(DISTINCT question.id)::int questions,topic.last_seen_at
                         FROM topics topic LEFT JOIN competitors competitor ON competitor.id=topic.competitor_id
                         LEFT JOIN campaign_competitors link ON link.competitor_id=competitor.id
                         LEFT JOIN pain_points pain ON pain.topic_id=topic.id LEFT JOIN questions question ON question.topic_id=topic.id
                         WHERE ($1::uuid IS NULL OR link.campaign_id=$1)
                         GROUP BY topic.id,competitor.username ORDER BY topic.momentum_7d DESC NULLS LAST LIMIT 200`,
  'content-opportunity': `SELECT opportunity.id,campaign.name campaign,opportunity.thesis,opportunity.angle,opportunity.hook,
                          opportunity.opportunity_score,opportunity.status,opportunity.created_at
                          FROM content_opportunities opportunity LEFT JOIN campaigns campaign ON campaign.id=opportunity.campaign_id
                          WHERE ($1::uuid IS NULL OR opportunity.campaign_id=$1)
                          ORDER BY opportunity.opportunity_score DESC,opportunity.created_at DESC LIMIT 200`,
  community: `SELECT community.id,community.name,community.size,community.cohesion_score,community.last_refreshed_at,
              count(membership.lead_id)::int members FROM communities community
              LEFT JOIN lead_community_membership membership ON membership.community_id=community.id
              LEFT JOIN lead_scores score ON score.lead_id=membership.lead_id AND ($1::uuid IS NULL OR score.campaign_id=$1)
              GROUP BY community.id HAVING $1::uuid IS NULL OR count(score.lead_id)>0
              ORDER BY community.cohesion_score DESC NULLS LAST LIMIT 200`,
  conversations: conversationsQuery,
  timeline: `SELECT event.id,lead.username_current lead,event.channel,event.event_type,event.at,event.source,event.metadata,event.external_ref
             FROM timeline_events event LEFT JOIN leads lead ON lead.id=event.lead_id
             WHERE ($1::uuid IS NULL OR event.campaign_id=$1) ORDER BY event.at DESC LIMIT 300`,
  identities: `SELECT candidate.id,a.username_current lead_a,b.username_current lead_b,candidate.reason,candidate.confidence,candidate.evidence,candidate.status,candidate.created_at
               FROM identity_candidates candidate JOIN leads a ON a.id=candidate.lead_id_a JOIN leads b ON b.id=candidate.lead_id_b
               WHERE $1::uuid IS NULL OR EXISTS(SELECT 1 FROM lead_scores score WHERE score.campaign_id=$1 AND score.lead_id IN(candidate.lead_id_a,candidate.lead_id_b))
               ORDER BY candidate.status='pending' DESC,candidate.confidence DESC LIMIT 200`,
  'email-flows': `SELECT flow.id,campaign.name campaign,flow.name,flow.description,flow.active,flow.version,
                  count(state.subscriber_id)::int subscribers,count(state.subscriber_id) FILTER(WHERE state.status='active')::int active_subscribers
                  FROM email_flows flow LEFT JOIN campaigns campaign ON campaign.id=flow.campaign_id LEFT JOIN email_flow_state state ON state.flow_id=flow.id
                  WHERE ($1::uuid IS NULL OR flow.campaign_id=$1) GROUP BY flow.id,campaign.name ORDER BY flow.active DESC,flow.name`,
  'contact-policies': `SELECT policy.id,campaign.name campaign,policy.channel,policy.cadence_seconds,policy.enabled,policy.rules
                       FROM contact_policies policy LEFT JOIN campaigns campaign ON campaign.id=policy.campaign_id
                       WHERE policy.campaign_id IS NULL OR $1::uuid IS NULL OR policy.campaign_id=$1
                       ORDER BY policy.enabled DESC,campaign.name NULLS FIRST,policy.channel NULLS FIRST`,
  'source-roi': `SELECT metric.id,metric.source_type,metric.source_id,campaign.name campaign,metric.window_days,metric.unique_leads,
                 metric.followback_rate,metric.retention_7d_rate,metric.conversion_rate,metric.source_score,metric.computed_at
                 FROM source_metrics metric LEFT JOIN campaigns campaign ON campaign.id=metric.campaign_id
                 WHERE ($1::uuid IS NULL OR metric.campaign_id=$1) ORDER BY metric.source_score DESC NULLS LAST,metric.computed_at DESC LIMIT 300`,
  configs: `SELECT config.campaign_id id,campaign.name campaign,config.p0_threshold,config.p1_threshold,config.p2_threshold,
            config.lambda_freshness,config.source_weights FROM campaign_scoring_config config JOIN campaigns campaign ON campaign.id=config.campaign_id
            WHERE ($1::uuid IS NULL OR config.campaign_id=$1) ORDER BY campaign.name`,
}

import { cache } from 'react'

// PG error codes that indicate a view/table isn't ready yet (not a real server fault)
const STALE_PG_CODES = new Set(['55000', '42P01'])

export const loadDashboardView = cache(async (view: DashboardView) => {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const { selected } = await getCampaignContext(pool)
  try {
    const items = (await pool.query(queries[view], [selected?.id ?? null])).rows as Array<Record<string, unknown>>
    return { items, campaign: selected, generatedAt: new Date().toISOString() }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code && STALE_PG_CODES.has(code)) {
      return { items: [] as Array<Record<string, unknown>>, campaign: selected, generatedAt: new Date().toISOString(), stale: true as const }
    }
    throw err
  }
})

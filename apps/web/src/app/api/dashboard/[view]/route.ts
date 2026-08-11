import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const ViewSchema = z.enum(['overview', 'radar', 'market-radar', 'competitive-intel', 'content-opportunity', 'community', 'conversations', 'timeline', 'identities', 'email-flows', 'contact-policies', 'source-roi', 'configs'])

const queries: Record<z.infer<typeof ViewSchema>, string> = {
  overview: `SELECT campaign_id, name, leads, conversions, completed_actions, recommendations FROM mv_campaign_performance ORDER BY name`,
  radar: `SELECT radar.post_id, radar.opportunity_score, radar.velocity, radar.new_leads, radar.avg_intent, post.post_url, competitor.username competitor
          FROM post_radar radar JOIN posts post ON post.id = radar.post_id JOIN competitors competitor ON competitor.id = post.competitor_id
          ORDER BY radar.opportunity_score DESC NULLS LAST LIMIT 100`,
  'market-radar': `SELECT signal.id,campaign.name campaign,signal.kind,signal.label,signal.velocity_7d,signal.velocity_30d,signal.volume_current,signal.status,signal.last_seen_at,signal.evidence_refs FROM market_signals signal LEFT JOIN campaigns campaign ON campaign.id=signal.campaign_id ORDER BY signal.velocity_7d DESC NULLS LAST,signal.last_seen_at DESC LIMIT 200`,
  'competitive-intel': `SELECT topic.label topic, competitor.username competitor, topic.momentum_7d, topic.momentum_30d,
                         count(DISTINCT pain.id) pain_points, count(DISTINCT question.id) questions
                         FROM topics topic LEFT JOIN competitors competitor ON competitor.id = topic.competitor_id
                         LEFT JOIN pain_points pain ON pain.topic_id = topic.id LEFT JOIN questions question ON question.topic_id = topic.id
                         GROUP BY topic.id, competitor.username ORDER BY topic.momentum_7d DESC NULLS LAST LIMIT 100`,
  'content-opportunity': `SELECT opportunity.id, campaign.name campaign, opportunity.thesis, opportunity.angle, opportunity.hook,
                          opportunity.opportunity_score, opportunity.status, opportunity.created_at
                          FROM content_opportunities opportunity LEFT JOIN campaigns campaign ON campaign.id = opportunity.campaign_id
                          ORDER BY opportunity.opportunity_score DESC, opportunity.created_at DESC LIMIT 100`,
  community: `SELECT community.id, community.name, community.size, community.cohesion_score, community.last_refreshed_at,
              count(membership.lead_id) members FROM communities community
              LEFT JOIN lead_community_membership membership ON membership.community_id = community.id
              GROUP BY community.id ORDER BY community.cohesion_score DESC NULLS LAST LIMIT 100`,
  conversations: `SELECT * FROM (SELECT thread.id,'instagram' channel,account.username account,thread.participant_username participant,thread.unread_count,thread.last_message_at,state.current_stage stage,state.detected_intent,state.requires_human_review,NULL::timestamptz session_window_expires_at,NULL::jsonb optin_evidence FROM own_dm_threads thread JOIN accounts account ON account.id=thread.account_id LEFT JOIN conversation_state state ON state.thread_id=thread.id UNION ALL SELECT conversation.id,'whatsapp' channel,NULL account,identity.external_handle participant,0 unread_count,COALESCE(conversation.last_inbound_at,conversation.last_outbound_at) last_message_at,conversation.stage,NULL detected_intent,conversation.requires_human_review,conversation.session_window_expires_at,optin.evidence optin_evidence FROM whatsapp_conversations conversation LEFT JOIN whatsapp_optins optin ON optin.id=conversation.optin_id LEFT JOIN identities identity ON identity.lead_id=conversation.lead_id AND identity.channel='whatsapp') conversations ORDER BY last_message_at DESC NULLS LAST LIMIT 200`,
  timeline: `SELECT event.id,lead.username_current lead,event.channel,event.event_type,event.at,event.source,event.metadata,event.external_ref FROM timeline_events event LEFT JOIN leads lead ON lead.id=event.lead_id ORDER BY event.at DESC LIMIT 200`,
  identities: `SELECT candidate.id,a.username_current lead_a,b.username_current lead_b,candidate.reason,candidate.confidence,candidate.evidence,candidate.status,candidate.created_at FROM identity_candidates candidate JOIN leads a ON a.id=candidate.lead_id_a JOIN leads b ON b.id=candidate.lead_id_b ORDER BY candidate.status='pending' DESC,candidate.confidence DESC LIMIT 200`,
  'email-flows': `SELECT flow.id,campaign.name campaign,flow.name,flow.description,flow.active,flow.version,count(state.subscriber_id) subscribers,count(state.subscriber_id) FILTER(WHERE state.status='active') active_subscribers FROM email_flows flow LEFT JOIN campaigns campaign ON campaign.id=flow.campaign_id LEFT JOIN email_flow_state state ON state.flow_id=flow.id GROUP BY flow.id,campaign.name ORDER BY flow.active DESC,flow.name`,
  'contact-policies': `SELECT policy.id,campaign.name campaign,policy.channel,policy.cadence_seconds,policy.enabled,policy.rules FROM contact_policies policy LEFT JOIN campaigns campaign ON campaign.id=policy.campaign_id ORDER BY policy.enabled DESC,campaign.name NULLS FIRST,policy.channel NULLS FIRST`,
  'source-roi': `SELECT metric.source_type, metric.source_id, campaign.name campaign, metric.window_days, metric.unique_leads,
                 metric.followback_rate, metric.retention_7d_rate, metric.conversion_rate, metric.source_score, metric.computed_at
                 FROM source_metrics metric LEFT JOIN campaigns campaign ON campaign.id = metric.campaign_id
                 ORDER BY metric.source_score DESC NULLS LAST, metric.computed_at DESC LIMIT 200`,
  configs: `SELECT config.campaign_id, campaign.name campaign, config.p0_threshold, config.p1_threshold, config.p2_threshold,
            config.lambda_freshness, config.source_weights FROM campaign_scoring_config config JOIN campaigns campaign ON campaign.id = config.campaign_id
            ORDER BY campaign.name`,
}

export async function GET(_request: Request, { params }: { params: Promise<{ view: string }> }) {
  await requireRole('viewer')
  const parsed = ViewSchema.safeParse((await params).view)
  if (!parsed.success) return NextResponse.json({ error: 'unknown_view' }, { status: 404 })
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    return NextResponse.json({ items: (await pool.query(queries[parsed.data])).rows })
  } finally {
    await pool.end()
  }
}

import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { LeadsClient, type LeadRow } from './LeadsClient'

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ priority?: string }> }) {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const priority = (await searchParams).priority
    const initialView = ['P0','P1','P2','P3'].includes(priority ?? '') ? priority! : 'Todos'
    const result = await pool.query<LeadRow>(`SELECT l.id,l.username_current,l.profile_url,l.last_seen_at,lp.is_private,lp.is_verified,ls.final_score,ls.priority,ls.intent_score,ls.relationship_score,ls.freshness_score,
      COALESCE((SELECT array_remove(array_agg(DISTINCT cc.intent),NULL) FROM lead_sources src JOIN comment_classification cc ON cc.comment_id=src.comment_id WHERE src.lead_id=l.id AND src.campaign_id=ls.campaign_id),'{}') intents,
      COALESCE((SELECT array_remove(array_agg(DISTINCT src.source_kind),NULL) FROM lead_sources src WHERE src.lead_id=l.id AND src.campaign_id=ls.campaign_id),'{}') sources,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'text',COALESCE(i.payload->>'text',''),'at',i.at,'direction',i.direction,'source',i.source) ORDER BY i.at DESC) FROM (SELECT * FROM lead_interactions WHERE lead_id=l.id AND campaign_id=ls.campaign_id ORDER BY at DESC LIMIT 20) i),'[]') interactions,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('channel',identity.channel,'handle',identity.external_handle,'verified',identity.verified) ORDER BY identity.verified DESC) FROM identities identity WHERE identity.lead_id=l.id),'[]') identities,
      COALESCE((SELECT array_agg(community.name ORDER BY membership.membership_strength DESC) FROM lead_community_membership membership JOIN communities community ON community.id=membership.community_id WHERE membership.lead_id=l.id),'{}') communities,
      (SELECT jsonb_build_object('id',nba.id,'action',nba.suggested_action,'channel',nba.chosen_channel,'rationale',nba.rationale,'confidence',nba.confidence) FROM nba_recommendations nba WHERE nba.lead_id=l.id AND nba.campaign_id=ls.campaign_id AND nba.status='pending' ORDER BY nba.confidence DESC,nba.suggested_at DESC LIMIT 1) nba
      FROM leads l JOIN lead_scores ls ON ls.lead_id=l.id LEFT JOIN lead_profile lp ON lp.lead_id=l.id
      WHERE ($1::uuid IS NULL OR ls.campaign_id=$1) AND l.merged_into IS NULL
      ORDER BY ls.final_score DESC,CASE ls.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,l.id LIMIT 300`, [selected?.id ?? null])
    return <LeadsClient initialRows={result.rows} />
  } finally {}
}

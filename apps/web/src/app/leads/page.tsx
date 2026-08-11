import { createDatabase } from '@plataforma/db'
import { LeadsClient, type LeadRow } from './LeadsClient'

export const dynamic = 'force-dynamic'
export default async function LeadsPage() {
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const result = await pool.query<LeadRow>(`SELECT l.id,l.username_current,l.profile_url,l.last_seen_at,lp.is_private,lp.is_verified,ls.final_score,ls.priority,ls.intent_score,ls.relationship_score,
      COALESCE((SELECT array_remove(array_agg(DISTINCT cc.intent),NULL) FROM lead_sources src JOIN comment_classification cc ON cc.comment_id=src.comment_id WHERE src.lead_id=l.id),'{}') intents,
      COALESCE((SELECT array_remove(array_agg(DISTINCT src.source_kind),NULL) FROM lead_sources src WHERE src.lead_id=l.id),'{}') sources,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'text',COALESCE(i.payload->>'text',''),'at',i.at,'direction',i.direction,'source',i.source) ORDER BY i.at DESC) FROM (SELECT * FROM lead_interactions WHERE lead_id=l.id ORDER BY at DESC LIMIT 20) i),'[]') interactions
      FROM leads l JOIN lead_scores ls ON ls.lead_id=l.id LEFT JOIN lead_profile lp ON lp.lead_id=l.id ORDER BY ls.final_score DESC,CASE ls.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,l.id LIMIT 100`)
    return <LeadsClient initialRows={result.rows}/>
  } finally { await pool.end() }
}

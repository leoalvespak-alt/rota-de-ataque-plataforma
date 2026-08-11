import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createSourceRoiProcessor, spec, type SourceRoiRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)
const autoApply = process.env.SOURCE_ROI_AUTOAPPLY === 'true'

const repository: SourceRoiRepository = {
  async aggregate(payload, traceId) {
    const days = payload.windowDays ?? 7
    const apply = payload.apply === true && autoApply
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const rows = await client.query(`WITH src AS(SELECT ls.source_kind source_type,COALESCE(ls.competitor_id::text,ls.source_kind) source_id,ls.campaign_id,COUNT(*) leads_generated,COUNT(DISTINCT ls.lead_id) unique_leads,COUNT(DISTINCT r.lead_id)::numeric/NULLIF(COUNT(DISTINCT ls.lead_id),0) followback_rate,COUNT(DISTINCT i.lead_id)::numeric/NULLIF(COUNT(DISTINCT ls.lead_id),0) interaction_rate,COUNT(DISTINCT cv.id)::numeric/NULLIF(COUNT(DISTINCT ls.lead_id),0) conversion_rate FROM lead_sources ls LEFT JOIN reciprocity_events r ON r.lead_id=ls.lead_id AND r.detected_at>=now()-($1||' days')::interval LEFT JOIN lead_interactions i ON i.lead_id=ls.lead_id AND i.at>=now()-($1||' days')::interval LEFT JOIN conversion_events cv ON cv.lead_id=ls.lead_id AND cv.at>=now()-($1||' days')::interval WHERE ls.discovered_at>=now()-($1||' days')::interval AND($2::uuid IS NULL OR ls.campaign_id=$2) GROUP BY ls.source_kind,COALESCE(ls.competitor_id::text,ls.source_kind),ls.campaign_id) SELECT *,LEAST(100,unique_leads*2+COALESCE(followback_rate,0)*30+COALESCE(interaction_rate,0)*20+COALESCE(conversion_rate,0)*50) source_score FROM src`, [days, payload.campaignId ?? null])
      let suggestions = 0, regressions = 0
      for (const row of rows.rows) {
        await client.query(`INSERT INTO source_metrics(source_type,source_id,campaign_id,window_days,leads_generated,unique_leads,followback_rate,interaction_rate,conversion_rate,source_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [row.source_type,row.source_id,row.campaign_id,days,row.leads_generated,row.unique_leads,row.followback_rate,row.interaction_rate,row.conversion_rate,row.source_score])
        const previous = (await client.query(`SELECT source_score FROM source_metrics WHERE source_type=$1 AND source_id=$2 AND campaign_id=$3 AND computed_at<now()-interval '7 days' ORDER BY computed_at DESC LIMIT 1`, [row.source_type,row.source_id,row.campaign_id])).rows[0]
        if (previous && Number(row.source_score) < Number(previous.source_score) * .5) { regressions++; await client.query(`INSERT INTO alerts(kind,severity,payload,fingerprint) VALUES('source_regression','warn',$1,$2)`, [JSON.stringify({sourceType:row.source_type,sourceId:row.source_id,observed:row.source_score,previous:previous.source_score,traceId}),`source_regression:${row.campaign_id}:${row.source_type}:${row.source_id}`]) }
        suggestions++
        const proposal = { sourceType: row.source_type, sourceId: row.source_id, score: row.source_score, alpha: .1, windowDays: days, dryRun: !apply, requestedApply: payload.apply === true, autoApply }
        await client.query(`INSERT INTO events(campaign_id,scope,level,payload) VALUES($1,'source_roi','config_change_proposed',$2::jsonb)`, [row.campaign_id, JSON.stringify({...proposal,traceId})])
        await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES('source-roi',$1,$2,$3)`, [apply?'source_weight.applied':'source_weight.suggested',row.campaign_id,JSON.stringify(proposal)])
        if (apply) await client.query(`UPDATE campaign_scoring_config SET source_weights=jsonb_set(source_weights,ARRAY[$2],to_jsonb(COALESCE((source_weights->>$2)::numeric,0)*0.9+$3::numeric*0.1),true) WHERE campaign_id=$1`, [row.campaign_id,row.source_type,row.source_score])
      }
      await client.query('COMMIT')
      await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_content_performance_by_thesis`)
      return { sources: rows.rowCount ?? 0, suggestions, regressions }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }
}

runWorker(spec.queue, createSourceRoiProcessor(repository))

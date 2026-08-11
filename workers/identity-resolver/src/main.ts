import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createIdentityProcessor, spec, type IdentityRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

interface MergeSnapshot {
  identity_ids: string[]
  interaction_ids: string[]
  source_rows: Array<Record<string, unknown>>
  timeline_ids: string[]
  email_subscriber_ids: string[]
  whatsapp_optin_ids: string[]
  whatsapp_conversation_ids: string[]
  scores: Array<Record<string, unknown>>
  survivor_score_campaign_ids: string[]
}

const repository: IdentityRepository = {
  async candidate(payload) {
    if (!payload.leadIdA || !payload.leadIdB || payload.leadIdA === payload.leadIdB) throw new Error('Two distinct leads are required')
    return (await pool.query<{ id: string }>(
      `INSERT INTO identity_candidates(lead_id_a,lead_id_b,reason,confidence,evidence)
       VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id`,
      [payload.leadIdA, payload.leadIdB, payload.reason ?? 'similar_identity', payload.confidence ?? 0.5, JSON.stringify({ verifiedEvidence: false })],
    )).rows[0]!.id
  },

  async approve(payload, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let pair: { lead_id_a: string; lead_id_b: string }
      if (payload.candidateId) {
        const row = (await client.query<{ lead_id_a: string; lead_id_b: string }>(
          `SELECT lead_id_a,lead_id_b FROM identity_candidates WHERE id=$1 AND status='pending' FOR UPDATE`,
          [payload.candidateId],
        )).rows[0]
        if (!row) throw new Error('Pending candidate not found')
        pair = row
      } else {
        if (!payload.leadIdA || !payload.leadIdB || !payload.verifiedEvidence || payload.leadIdA === payload.leadIdB) throw new Error('Verified evidence for two distinct leads is required for automatic merge')
        pair = { lead_id_a: payload.leadIdA, lead_id_b: payload.leadIdB }
      }

      const leads = (await client.query<{ id: string; first_seen_at: Date }>(
        `SELECT id,first_seen_at FROM leads WHERE id=ANY($1::uuid[]) AND merged_into IS NULL ORDER BY first_seen_at ASC,id ASC FOR UPDATE`,
        [[pair.lead_id_a, pair.lead_id_b]],
      )).rows
      if (leads.length !== 2) throw new Error('Two active merge leads were not found')
      const survivor = leads[0]!.id
      const merged = leads[1]!.id

      const snapshot = (await client.query<{ snapshot: MergeSnapshot }>(
        `SELECT jsonb_build_object(
          'identity_ids',COALESCE((SELECT jsonb_agg(id) FROM identities WHERE lead_id=$1),'[]'::jsonb),
          'interaction_ids',COALESCE((SELECT jsonb_agg(id) FROM lead_interactions WHERE lead_id=$1),'[]'::jsonb),
          'source_rows',COALESCE((SELECT jsonb_agg(to_jsonb(source)) FROM lead_sources source WHERE lead_id=$1),'[]'::jsonb),
          'timeline_ids',COALESCE((SELECT jsonb_agg(id) FROM timeline_events WHERE lead_id=$1),'[]'::jsonb),
          'email_subscriber_ids',COALESCE((SELECT jsonb_agg(id) FROM email_subscribers WHERE lead_id=$1),'[]'::jsonb),
          'whatsapp_optin_ids',COALESCE((SELECT jsonb_agg(id) FROM whatsapp_optins WHERE lead_id=$1),'[]'::jsonb),
          'whatsapp_conversation_ids',COALESCE((SELECT jsonb_agg(id) FROM whatsapp_conversations WHERE lead_id=$1),'[]'::jsonb),
          'scores',COALESCE((SELECT jsonb_agg(to_jsonb(score)) FROM lead_scores score WHERE lead_id=$1),'[]'::jsonb),
          'survivor_score_campaign_ids',COALESCE((SELECT jsonb_agg(campaign_id) FROM lead_scores WHERE lead_id=$2),'[]'::jsonb)
        ) snapshot`,
        [merged, survivor],
      )).rows[0]!.snapshot

      const snapshotId = (await client.query<{ id: string }>(
        `INSERT INTO identity_merge_snapshots(survivor_lead_id,merged_lead_id,snapshot) VALUES($1,$2,$3::jsonb) RETURNING id`,
        [survivor, merged, JSON.stringify(snapshot)],
      )).rows[0]!.id

      await client.query(`DELETE FROM lead_scores WHERE lead_id=$1 AND campaign_id IN(SELECT campaign_id FROM lead_scores WHERE lead_id=$2)`, [merged, survivor])
      await client.query(`DELETE FROM lead_sources source WHERE source.lead_id=$1 AND EXISTS(SELECT 1 FROM lead_sources kept WHERE kept.lead_id=$2 AND kept.comment_id IS NOT DISTINCT FROM source.comment_id)`, [merged, survivor])
      for (const table of ['identities', 'lead_interactions', 'lead_sources', 'timeline_events', 'email_subscribers', 'whatsapp_optins', 'whatsapp_conversations', 'lead_scores']) {
        await client.query(`UPDATE ${table} SET lead_id=$2 WHERE lead_id=$1`, [merged, survivor])
      }
      await client.query(`UPDATE leads SET merged_into=$2 WHERE id=$1`, [merged, survivor])
      if (payload.candidateId) await client.query(`UPDATE identity_candidates SET status='approved',decided_by=$2,decided_at=now() WHERE id=$1`, [payload.candidateId, payload.decidedBy ?? 'system'])
      await client.query(`INSERT INTO timeline_events(lead_id,channel,event_type,external_ref,metadata,source) VALUES($1,'system','system.identity_merge',$2::jsonb,$3::jsonb,'system')`, [survivor, JSON.stringify({ snapshot_id: snapshotId, merged_lead_id: merged }), JSON.stringify({ traceId })])
      await client.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'identity.merge',$2,$3::jsonb,$4::jsonb)`, [payload.decidedBy ?? 'system', merged, JSON.stringify({ merged }), JSON.stringify({ survivor, snapshotId })])
      await client.query('COMMIT')
      return snapshotId
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  async reject(payload) {
    if (!payload.candidateId) throw new Error('candidateId required')
    await pool.query(`UPDATE identity_candidates SET status='rejected',decided_by=$2,decided_at=now() WHERE id=$1 AND status='pending'`, [payload.candidateId, payload.decidedBy ?? 'system'])
  },

  async rollback(payload, traceId) {
    if (!payload.snapshotId) throw new Error('snapshotId required')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const row = (await client.query<{ survivor_lead_id: string; merged_lead_id: string; snapshot: MergeSnapshot }>(
        `SELECT survivor_lead_id,merged_lead_id,snapshot FROM identity_merge_snapshots WHERE id=$1 AND reverted_at IS NULL AND expires_at>now() FOR UPDATE`,
        [payload.snapshotId],
      )).rows[0]
      if (!row) throw new Error('Reversible snapshot not found')

      const uuidSets = [
        ['identities', 'identity_ids'],
        ['lead_interactions', 'interaction_ids'],
        ['email_subscribers', 'email_subscriber_ids'],
        ['whatsapp_optins', 'whatsapp_optin_ids'],
        ['whatsapp_conversations', 'whatsapp_conversation_ids'],
      ] as const
      for (const [table, key] of uuidSets) {
        const ids = row.snapshot[key] ?? []
        if (ids.length) await client.query(`UPDATE ${table} SET lead_id=$2 WHERE id=ANY($1::uuid[])`, [ids, row.merged_lead_id])
      }
      if (row.snapshot.timeline_ids?.length) await client.query(`UPDATE timeline_events SET lead_id=$2 WHERE id=ANY($1::bigint[])`, [row.snapshot.timeline_ids, row.merged_lead_id])

      const sourceRows = JSON.stringify(row.snapshot.source_rows ?? [])
      await client.query(
        `UPDATE lead_sources source SET lead_id=$2
         WHERE source.id IN (SELECT id FROM jsonb_to_recordset($1::jsonb) AS restored(id uuid))`,
        [sourceRows, row.merged_lead_id],
      )
      await client.query(
        `INSERT INTO lead_sources(id,lead_id,campaign_id,competitor_id,post_id,comment_id,source_kind,discovered_at)
         SELECT restored.id,$2,restored.campaign_id,restored.competitor_id,restored.post_id,restored.comment_id,restored.source_kind,restored.discovered_at
         FROM jsonb_to_recordset($1::jsonb) AS restored(id uuid,lead_id uuid,campaign_id uuid,competitor_id uuid,post_id uuid,comment_id uuid,source_kind text,discovered_at timestamptz)
         ON CONFLICT DO NOTHING`,
        [sourceRows, row.merged_lead_id],
      )

      const scores = JSON.stringify(row.snapshot.scores ?? [])
      const survivorCampaigns = row.snapshot.survivor_score_campaign_ids ?? []
      await client.query(
        `DELETE FROM lead_scores WHERE lead_id=$1
         AND campaign_id IN (SELECT campaign_id FROM jsonb_to_recordset($2::jsonb) AS restored(campaign_id uuid))
         AND NOT (campaign_id=ANY($3::uuid[]))`,
        [row.survivor_lead_id, scores, survivorCampaigns],
      )
      await client.query(
        `INSERT INTO lead_scores(lead_id,campaign_id,base_score,intent_score,relationship_score,audience_overlap_score,freshness_multiplier,final_score,priority,computed_at,content_affinity,email_engagement_score,whatsapp_engagement_score,freshness_score)
         SELECT $2,restored.campaign_id,restored.base_score,restored.intent_score,restored.relationship_score,restored.audience_overlap_score,restored.freshness_multiplier,restored.final_score,restored.priority,restored.computed_at,restored.content_affinity,restored.email_engagement_score,restored.whatsapp_engagement_score,restored.freshness_score
         FROM jsonb_to_recordset($1::jsonb) AS restored(campaign_id uuid,base_score numeric,intent_score numeric,relationship_score numeric,audience_overlap_score numeric,freshness_multiplier numeric,final_score numeric,priority text,computed_at timestamptz,content_affinity jsonb,email_engagement_score numeric,whatsapp_engagement_score numeric,freshness_score numeric)
         ON CONFLICT(lead_id,campaign_id) DO UPDATE SET base_score=EXCLUDED.base_score,intent_score=EXCLUDED.intent_score,relationship_score=EXCLUDED.relationship_score,audience_overlap_score=EXCLUDED.audience_overlap_score,freshness_multiplier=EXCLUDED.freshness_multiplier,final_score=EXCLUDED.final_score,priority=EXCLUDED.priority,computed_at=EXCLUDED.computed_at,content_affinity=EXCLUDED.content_affinity,email_engagement_score=EXCLUDED.email_engagement_score,whatsapp_engagement_score=EXCLUDED.whatsapp_engagement_score,freshness_score=EXCLUDED.freshness_score`,
        [scores, row.merged_lead_id],
      )

      await client.query(`UPDATE leads SET merged_into=NULL WHERE id=$1`, [row.merged_lead_id])
      await client.query(`UPDATE identity_merge_snapshots SET reverted_at=now() WHERE id=$1`, [payload.snapshotId])
      await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'identity.rollback',$2,$3::jsonb)`, [payload.decidedBy ?? 'system', row.merged_lead_id, JSON.stringify({ traceId })])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

runWorker(spec.queue, createIdentityProcessor(repository))

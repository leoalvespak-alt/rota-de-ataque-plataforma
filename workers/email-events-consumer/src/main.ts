import { createHash } from 'node:crypto'
import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createEmailEventConsumer, spec, type EmailEventRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const { pool } = createDatabase(databaseUrl)

const repository: EmailEventRepository = {
  async consume(event, traceId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let subscriber = (await client.query<{id:string;lead_id:string|null}>(`SELECT id,lead_id FROM email_subscribers WHERE lower(email)=lower($1) OR id=(SELECT subscriber_id FROM email_events WHERE metadata->>'message_id'=$2 LIMIT 1)`, [event.email ?? '', event.messageId ?? ''])).rows[0]
      if (!subscriber && event.email) subscriber = (await client.query<{id:string;lead_id:string|null}>(`SELECT id,lead_id FROM email_subscribers WHERE email_hash=$1`, [createHash('sha256').update(event.email.toLowerCase()).digest()])).rows[0]
      if (!subscriber) { await client.query('ROLLBACK'); return { inserted: false } }

      const metadataVariant = typeof event.metadata.variant_id === 'string' ? event.metadata.variant_id : null
      const variantId = metadataVariant ?? (await client.query<{variant_id:string|null}>(`SELECT variant_id FROM email_events WHERE subscriber_id=$1 AND (external_event_id=$2 OR metadata->>'message_id'=$2) AND variant_id IS NOT NULL ORDER BY at DESC LIMIT 1`, [subscriber.id, event.messageId ?? ''])).rows[0]?.variant_id ?? null
      const inserted = (await client.query<{id:number}>(`INSERT INTO email_events(subscriber_id,variant_id,kind,metadata,at,provider,external_event_id) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7) ON CONFLICT(provider,external_event_id,kind) WHERE external_event_id IS NOT NULL DO NOTHING RETURNING id`, [subscriber.id, variantId, event.kind, JSON.stringify({ ...event.metadata, message_id: event.messageId }), event.occurredAt, event.provider, event.externalEventId])).rows[0]
      if (!inserted) { await client.query('COMMIT'); return { inserted: false, subscriberId: subscriber.id, leadId: subscriber.lead_id ?? undefined } }

      if (['bounced','complained','unsubscribed'].includes(event.kind)) {
        const reason = event.kind === 'bounced' ? 'hard_bounce' : event.kind === 'complained' ? 'complaint' : 'unsubscribe'
        await client.query(`INSERT INTO email_suppressions(email_hash,reason) SELECT email_hash,$2 FROM email_subscribers WHERE id=$1 ON CONFLICT(email_hash) DO UPDATE SET reason=EXCLUDED.reason,suppressed_at=now()`, [subscriber.id, reason])
        await client.query(`UPDATE email_subscribers SET unsubscribed_at=CASE WHEN $2 IN ('complained','unsubscribed') THEN now() ELSE unsubscribed_at END,hard_bounced_at=CASE WHEN $2='bounced' THEN now() ELSE hard_bounced_at END WHERE id=$1`, [subscriber.id, event.kind])
        await client.query(`UPDATE email_flow_state SET status='suppressed' WHERE subscriber_id=$1 AND status='active'`, [subscriber.id])
      }
      if (event.kind === 'replied') {
        await client.query(`UPDATE email_flow_state SET status='paused' WHERE subscriber_id=$1 AND status='active'`, [subscriber.id])
        await client.query(`INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('email_reply',$1,'Subscriber replied; human continuation required',$2::jsonb,$3::jsonb)`, [subscriber.id, JSON.stringify({ action: 'reply_manually' }), JSON.stringify({ traceId })])
      }
      if (variantId) {
        const impression = event.kind === 'opened' ? 1 : 0
        const click = event.kind === 'clicked' ? 1 : 0
        const reply = event.kind === 'replied' ? 1 : 0
        await client.query(`INSERT INTO content_performance(variant_id,channel,impressions,reach,engagements,clicks,replies) VALUES($1,'email',$2,$2,$3,$4,$5) ON CONFLICT(variant_id) DO UPDATE SET impressions=content_performance.impressions+$2,reach=GREATEST(content_performance.reach,$2),engagements=content_performance.engagements+$3,clicks=content_performance.clicks+$4,replies=content_performance.replies+$5,computed_at=now()`, [variantId, impression, click + reply, click, reply])
        if (subscriber.lead_id && (click || reply)) await client.query(`WITH topic AS (SELECT item.thesis_id::text key FROM content_variants variant JOIN content_items item ON item.id=variant.content_item_id WHERE variant.id=$2) UPDATE lead_scores score SET content_affinity=jsonb_set(COALESCE(score.content_affinity,'{}'::jsonb),ARRAY[topic.key],to_jsonb(COALESCE((score.content_affinity->>topic.key)::numeric,0)*0.9+$3::numeric*0.1),true) FROM topic WHERE score.lead_id=$1`, [subscriber.lead_id, variantId, reply ? 1 : 0.6])
      }
      if (subscriber.lead_id) await client.query(`INSERT INTO timeline_events(lead_id,channel,event_type,variant_id,external_ref,metadata,at,source) VALUES($1,'email',$2,$3,$4::jsonb,$5::jsonb,$6,'webhook')`, [subscriber.lead_id, `email.${event.kind}`, variantId, JSON.stringify({ message_id: event.messageId }), JSON.stringify(event.metadata), event.occurredAt])
      await client.query('COMMIT')
      return { inserted: true, subscriberId: subscriber.id, leadId: subscriber.lead_id ?? undefined }
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }
}

runWorker(spec.queue, createEmailEventConsumer(repository))

import { createHash } from 'node:crypto'
import { createDatabase } from '@plataforma/db'
import { runWorker } from '@plataforma/queue/runtime'
import { createWhatsAppInboundProcessor, isOptOut, spec, type WhatsAppInboundRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const salt = process.env.PII_HASH_SALT ?? 'not-configured'
const { pool } = createDatabase(databaseUrl)

const repository: WhatsAppInboundRepository = {
  async message(event, traceId) {
    if (!event.from) return
    if (salt === 'not-configured') throw new Error('PII_HASH_SALT is required when the WhatsApp inbound worker is enabled')
    const phoneHash = createHash('sha256').update(`${salt}:${event.from}`).digest()
    const externalId = phoneHash.toString('hex')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let identity = (await client.query<{ lead_id: string }>(`SELECT lead_id FROM identities WHERE channel='whatsapp' AND external_id=$1`, [externalId])).rows[0]
      if (!identity) {
        const lead = (await client.query<{ id: string }>(`INSERT INTO leads(username_current) VALUES($1) RETURNING id`, [`wa-${externalId.slice(0, 12)}`])).rows[0]!
        await client.query(`INSERT INTO identities(lead_id,channel,external_id,external_handle,verified,evidence) VALUES($1,'whatsapp',$2,$3,false,$4::jsonb)`, [lead.id, externalId, `***${event.from.slice(-4)}`, JSON.stringify({ inbound: true })])
        identity = { lead_id: lead.id }
      }
      const optin = (await client.query<{ id: string }>(`SELECT id FROM whatsapp_optins WHERE phone_hash=$1`, [phoneHash])).rows[0]
      let conversation = (await client.query<{ id: string }>(`SELECT id FROM whatsapp_conversations WHERE lead_id=$1 ORDER BY last_inbound_at DESC NULLS LAST LIMIT 1`, [identity.lead_id])).rows[0]
      if (!conversation) conversation = (await client.query<{ id: string }>(`INSERT INTO whatsapp_conversations(optin_id,lead_id,wa_conversation_id) VALUES($1,$2,$3) RETURNING id`, [optin?.id ?? null, identity.lead_id, event.from])).rows[0]!
      const inserted = (await client.query(`INSERT INTO whatsapp_messages(conversation_id,direction,kind,text,external_id,status,sent_at) VALUES($1,'inbound','text',$2,$3,'delivered',$4) ON CONFLICT(external_id) DO NOTHING RETURNING id`, [conversation.id, event.text ?? '', event.messageId, event.timestamp ?? new Date()])).rows[0]
      if (inserted) {
        await client.query(`UPDATE whatsapp_conversations SET last_inbound_at=$2,session_window_expires_at=$2+interval '24 hours',stage='engaged' WHERE id=$1`, [conversation.id, event.timestamp ?? new Date()])
        await client.query(`INSERT INTO timeline_events(lead_id,channel,event_type,external_ref,metadata,at,source) VALUES($1,'whatsapp','whatsapp.message_inbound',$2::jsonb,$3::jsonb,$4,'webhook')`, [identity.lead_id, JSON.stringify({ message_id: event.messageId, conversation_id: conversation.id }), JSON.stringify({ text: event.text }), event.timestamp ?? new Date()])
        if (isOptOut(event.text) && optin) {
          await client.query(`UPDATE whatsapp_optins SET status='revoked',opted_out_at=now() WHERE id=$1`, [optin.id])
          await client.query(`INSERT INTO timeline_events(lead_id,channel,event_type,source) VALUES($1,'whatsapp','whatsapp.opt_out','webhook')`, [identity.lead_id])
        } else {
          const sensitive = /jur[ií]dic|advogad|processo|amea[çc]a|reembolso|fraude|golpe/i.test(event.text ?? '')
          await client.query(`INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context) VALUES('whatsapp_reply',$1,$2,$3::jsonb,$4::jsonb)`, [conversation.id, sensitive ? 'Mensagem sensível; revisão humana obrigatória' : 'Resposta WhatsApp requer aprovação humana', JSON.stringify({ action: 'draft_reply' }), JSON.stringify({ traceId, inboundMessageId: event.messageId, text: event.text })])
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
  async status(event) {
    const status = event.status === 'read' ? 'read' : event.status === 'delivered' ? 'delivered' : event.status === 'sent' ? 'sent' : 'failed'
    const updated = (await pool.query<{variant_id:string|null}>(`UPDATE whatsapp_messages SET status=$2,delivered_at=CASE WHEN $2='delivered' THEN $3 ELSE delivered_at END,read_at=CASE WHEN $2='read' THEN $3 ELSE read_at END WHERE external_id=$1 RETURNING variant_id`, [event.messageId, status, event.timestamp ?? new Date()])).rows[0]
    if (updated?.variant_id && (status === 'delivered' || status === 'read')) await pool.query(`INSERT INTO content_performance(variant_id,channel,reach,engagements) VALUES($1,'whatsapp_dm',$2,$3) ON CONFLICT(variant_id) DO UPDATE SET reach=GREATEST(content_performance.reach,EXCLUDED.reach),engagements=GREATEST(content_performance.engagements,EXCLUDED.engagements),computed_at=now()`, [updated.variant_id, status === 'delivered' ? 1 : 0, status === 'read' ? 1 : 0])
  },
}

runWorker(spec.queue, createWhatsAppInboundProcessor(repository))

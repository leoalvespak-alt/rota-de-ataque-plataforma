import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const Input = z.object({ leadId:z.string().uuid(), campaignId:z.string().uuid().optional(), channel:z.enum(['instagram','threads','email','whatsapp']) }).strict()

/** Read-only policy evaluation. Sending an action remains a separate, audited workflow. */
export async function POST(request:Request) {
  try {
    await requireRole('operator')
    const parsed = Input.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return invalidRequestResponse()
    const input = parsed.data
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    try {
      const row = (await pool.query<{
        policy_id:string|null; cadence_seconds:number|null; last_outbound_at:Date|null; eligible:boolean; policy_scope:string|null
      }>(`SELECT policy.id policy_id, policy.cadence_seconds,
          (SELECT max(at) FROM timeline_events WHERE lead_id=$1 AND event_type IN ('instagram.dm_outbound','threads.reply_outbound','email.sent','whatsapp.message_outbound','whatsapp.template_sent')) last_outbound_at,
          CASE $3
            WHEN 'email' THEN EXISTS(SELECT 1 FROM email_subscribers WHERE lead_id=$1 AND double_optin_at IS NOT NULL AND unsubscribed_at IS NULL)
            WHEN 'whatsapp' THEN EXISTS(SELECT 1 FROM whatsapp_optins WHERE lead_id=$1 AND status='active')
            WHEN 'threads' THEN EXISTS(SELECT 1 FROM identities WHERE lead_id=$1 AND channel='threads')
            ELSE EXISTS(SELECT 1 FROM identities WHERE lead_id=$1 AND channel='instagram')
          END eligible,
          CASE WHEN policy.campaign_id IS NULL THEN 'global' ELSE 'campaign' END policy_scope
        FROM (SELECT * FROM contact_policies WHERE enabled=true AND (campaign_id=$2 OR campaign_id IS NULL) AND (channel=$3 OR channel IS NULL) ORDER BY campaign_id IS NOT NULL DESC, channel IS NOT NULL DESC LIMIT 1) policy`, [input.leadId,input.campaignId ?? null,input.channel])).rows[0]
      if (!row?.policy_id) return NextResponse.json({ allowed:false, reason:'no_active_policy', explanation:'Não existe uma política ativa para este canal e campanha.' })
      const cadenceEndsAt = row.last_outbound_at && row.cadence_seconds ? new Date(row.last_outbound_at.getTime() + row.cadence_seconds * 1000) : null
      const cadenceBlocked = Boolean(cadenceEndsAt && cadenceEndsAt > new Date())
      const allowed = Boolean(row.eligible) && !cadenceBlocked
      const reason = !row.eligible ? 'channel_not_eligible' : cadenceBlocked ? 'cadence_blocked' : 'policy_allowed'
      return NextResponse.json({ allowed, reason, policyId:row.policy_id, policyScope:row.policy_scope, cadenceSeconds:row.cadence_seconds, lastOutboundAt:row.last_outbound_at, nextAllowedAt:cadenceEndsAt, explanation: !row.eligible ? 'O lead não possui o consentimento ou identidade exigida para este canal.' : cadenceBlocked ? 'A cadência mínima ainda não terminou.' : 'A política permite o contato. Nenhuma ação foi enviada.' })
    } finally {}
  } catch (error) { return apiErrorResponse(error) }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const Input = z.object({
  thesisId: z.string().uuid().nullable().optional(), audienceSegment: z.string().trim().max(300).optional(),
  funnelStage: z.enum(['awareness', 'consideration', 'decision', 'retention']).default('awareness'), objective: z.string().trim().max(500).optional(),
  angle: z.string().trim().min(3).max(2000), hook: z.string().trim().min(3).max(500), arguments: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  cta: z.record(z.string(), z.unknown()).default({}), intelligenceSources: z.array(z.unknown()).max(30).default([]),
  brandVoiceVersion: z.string().trim().min(1).max(120).default('manual-v1'), createInstagramVariant: z.boolean().default(true),
}).strict()

export async function POST(request: Request) {
  try {
    const user = await requireRole('operator')
    const parsed = Input.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return invalidRequestResponse()
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const { selected } = await getCampaignContext(client)
      if (!selected) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'campaign_not_found' }, { status: 409 }) }
      const input = parsed.data
      const item = (await client.query<{ id: string }>(
        `INSERT INTO content_items(campaign_id,thesis_id,audience_segment,funnel_stage,objective,angle,hook,arguments,cta,intelligence_sources,brand_voice_version,status,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,'draft',$12) RETURNING id`,
        [selected.id,input.thesisId ?? null,input.audienceSegment ?? null,input.funnelStage,input.objective ?? null,input.angle,input.hook,JSON.stringify(input.arguments),JSON.stringify(input.cta),JSON.stringify(input.intelligenceSources),input.brandVoiceVersion,user.email ?? null],
      )).rows[0]!
      if (input.createInstagramVariant) await client.query(
        `INSERT INTO content_variants(content_item_id,channel,format,payload,status,generated_by) VALUES($1,'instagram','feed',$2::jsonb,'draft','manual')`,
        [item.id, JSON.stringify({ headline: input.hook, caption: input.angle, cta: input.cta, hashtags: [] })],
      )
      await client.query(`INSERT INTO content_item_revisions(content_item_id,revision,snapshot,changed_by) SELECT id,1,to_jsonb(content_items),$2 FROM content_items WHERE id=$1`, [item.id,user.email ?? null])
      await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'content_item.created',$2,$3::jsonb)`, [user.email ?? 'unknown',item.id,JSON.stringify({ campaignId:selected.id, manual:true })])
      await client.query('COMMIT')
      return NextResponse.json({ itemId: item.id }, { status: 201 })
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  } catch (error) { return apiErrorResponse(error) }
}

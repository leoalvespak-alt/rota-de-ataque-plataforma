import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { creativeBridgePayloadSchema } from '@plataforma/organic-intelligence'
import { requireRole } from '@/lib/permissions'

async function loadPayload(id: string, pool: ReturnType<typeof createDatabase>['pool']) {
  try {
    const result = await pool.query<{
      content_item_id: string; variant_id: string; opportunity_id: string; campaign_id: string; thesis: string; angle: string | null; hook: string;
      payload: { caption?: string; slides?: Array<Record<string, unknown>> }; source_references: Array<{ label?: string; url?: string }>;
    }>(`SELECT item.id content_item_id,variant.id variant_id,opportunity.id opportunity_id,item.campaign_id,opportunity.thesis,opportunity.angle,item.hook,
               variant.payload,opportunity.source_references
        FROM content_opportunities opportunity JOIN content_items item ON item.opportunity_id=opportunity.id
        JOIN content_variants variant ON variant.content_item_id=item.id AND variant.channel='instagram'
        WHERE opportunity.id=$1 AND opportunity.status='approved' ORDER BY item.content_version DESC LIMIT 1`, [id])
    const row = result.rows[0]
    if (!row) return null
    const references = (row.source_references ?? []).flatMap((reference) => reference.url && /^https:\/\//.test(reference.url) ? [{ label: reference.label ?? new URL(reference.url).hostname, url: reference.url }] : [])
    return creativeBridgePayloadSchema.parse({
      schema_version: '1.0', content_item_id: row.content_item_id, variant_id: row.variant_id, opportunity_id: row.opportunity_id,
      campaign_id: row.campaign_id, thesis: row.thesis, topic: row.thesis, hook: row.hook, copy: row.payload.caption ?? row.angle ?? row.hook,
      cta: 'Salve e compartilhe com quem precisa.', format: 'instagram_carousel', slide_structure: row.payload.slides ?? [],
      media_requirements: { aspectRatio: '4:5', reviewRequired: true }, template_recommendation: 'sq-cover', source_references: references,
      correlation_id: randomUUID(),
    })
  } finally { /* The request handler owns the shared pool lifecycle. */ }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole('operator')
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const payload = await loadPayload((await params).id, pool)
    return payload ? NextResponse.json({ type: 'creative-bridge', payload }) : NextResponse.json({ error: 'approved_draft_not_found' }, { status: 409 })
  } finally {}
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('operator')
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const payload = await loadPayload((await params).id, pool)
    if (!payload) return NextResponse.json({ error: 'approved_draft_not_found' }, { status: 409 })
    const delivery = (await pool.query(`INSERT INTO creative_bridge_deliveries(content_item_id,variant_id,schema_version,correlation_id,payload,status) VALUES($1,$2,$3,$4,$5::jsonb,'created') RETURNING *`, [payload.content_item_id, payload.variant_id, payload.schema_version, payload.correlation_id, JSON.stringify(payload)])).rows[0]
    await pool.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'creative_bridge.created',$2,$3::jsonb)`, [user.email ?? 'unknown', payload.content_item_id, JSON.stringify({ correlationId: payload.correlation_id, variantId: payload.variant_id })])
    return NextResponse.json({ type: 'creative-bridge', payload, delivery }, { status: 201 })
  } finally {}
}

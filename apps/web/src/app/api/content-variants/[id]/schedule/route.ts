import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const Body = z.object({ scheduledFor: z.string().datetime(), timezone: z.string().min(1).max(100).default('America/Sao_Paulo'), mediaAssetRef: z.string().max(1000).optional() }).strict()
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('operator')
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success || new Date(parsed.data?.scheduledFor ?? 0).getTime() <= Date.now()) return NextResponse.json({ error: 'invalid_schedule' }, { status: 400 })
  const { id } = await params
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const variant = (await client.query<{ id: string; channel: string; payload: Record<string, unknown>; approved_by: string | null; opportunity_id: string | null }>(
      `SELECT variant.id,variant.channel,variant.payload,variant.approved_by,item.opportunity_id FROM content_variants variant JOIN content_items item ON item.id=variant.content_item_id WHERE variant.id=$1 AND variant.status='approved' FOR UPDATE OF variant`, [id],
    )).rows[0]
    if (!variant?.approved_by || !['instagram', 'threads'].includes(variant.channel) || !variant.opportunity_id) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'approved_variant_required' }, { status: 409 }) }
    if (variant.channel === 'instagram' && !parsed.data.mediaAssetRef) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'instagram_asset_required' }, { status: 409 }) }
    const account = (await client.query<{ id: string }>(`SELECT id FROM accounts WHERE role='actor' AND status='HEALTHY' ORDER BY id LIMIT 1`)).rows[0]
    if (!account) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'healthy_actor_required' }, { status: 409 }) }
    const caption = String(variant.payload.caption ?? variant.payload.text ?? '')
    const scheduled = (await client.query(`INSERT INTO scheduled_publications(content_opportunity_id,variant_id,account_id,approved_by,caption,media_asset_ref,scheduled_for,status,channel)
      VALUES($1,$2,$3,$4,$5,$6,$7,'approved',$8)
      ON CONFLICT(variant_id,channel) WHERE variant_id IS NOT NULL DO UPDATE SET scheduled_for=EXCLUDED.scheduled_for,approved_by=EXCLUDED.approved_by,caption=EXCLUDED.caption,media_asset_ref=EXCLUDED.media_asset_ref,status='approved'
      RETURNING *`, [variant.opportunity_id, variant.id, account.id, user.email, caption, parsed.data.mediaAssetRef ?? null, parsed.data.scheduledFor, variant.channel])).rows[0]
    await client.query(`UPDATE content_variants SET scheduled_for=$2,timezone=$3 WHERE id=$1`, [id, parsed.data.scheduledFor, parsed.data.timezone])
    await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'content_variant.scheduled',$2,$3::jsonb)`, [user.email, id, JSON.stringify({ scheduledFor: parsed.data.scheduledFor, channel: variant.channel })])
    await client.query('COMMIT')
    return NextResponse.json({ scheduled })
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

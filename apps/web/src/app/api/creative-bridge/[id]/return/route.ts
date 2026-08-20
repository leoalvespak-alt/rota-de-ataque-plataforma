import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const Body = z.object({
  storageRef: z.string().trim().min(3).max(2048), filename: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(120).optional(), width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(), checksum: z.string().trim().max(256).optional(),
  copy: z.string().trim().max(16000).optional(), editorProjectId: z.string().trim().max(256).optional(),
}).strict()

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('operator')
    const body = Body.safeParse(await request.json().catch(() => null))
    if (!body.success) return invalidRequestResponse()
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const delivery = (await client.query<{ id: string; content_item_id: string; variant_id: string; correlation_id: string }>(
        `SELECT id,content_item_id,variant_id,correlation_id FROM creative_bridge_deliveries WHERE id=$1 FOR UPDATE`, [(await params).id],
      )).rows[0]
      if (!delivery) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'not_found' }, { status: 404 }) }
      const asset = (await client.query<{ id: string }>(
        `INSERT INTO content_assets(content_item_id,variant_id,storage_ref,filename,mime_type,width,height,checksum,status,source,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending_review','creative_bridge',$9) RETURNING id`,
        [delivery.content_item_id, delivery.variant_id, body.data.storageRef, body.data.filename ?? null, body.data.mimeType ?? null, body.data.width ?? null, body.data.height ?? null, body.data.checksum ?? null, user.email ?? null],
      )).rows[0]!
      await client.query(
        `UPDATE creative_bridge_deliveries SET status='returned',returned_at=now(),returned_asset_id=$2,return_payload=$3::jsonb,updated_at=now() WHERE id=$1`,
        [delivery.id, asset.id, JSON.stringify({ copy: body.data.copy ?? null, editorProjectId: body.data.editorProjectId ?? null })],
      )
      if (body.data.copy) await client.query(`UPDATE content_variants SET payload=payload || jsonb_build_object('caption',$2),status=CASE WHEN status='draft' THEN 'ready' ELSE status END WHERE id=$1`, [delivery.variant_id, body.data.copy])
      await client.query(`INSERT INTO review_inbox(item_type,item_ref_id,reason,suggested_action,context)
        SELECT 'content_variant',$1,'Arte retornou do Design System e requer aprovação humana',$2::jsonb,$3::jsonb
        WHERE NOT EXISTS(SELECT 1 FROM review_inbox WHERE item_type='content_variant' AND item_ref_id=$1 AND status='pending')`,
        [delivery.variant_id, JSON.stringify({ action: 'approve_instagram_variant' }), JSON.stringify({ correlationId: delivery.correlation_id, assetId: asset.id })])
      await client.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'creative_bridge.returned',$2,$3::jsonb)`, [user.email ?? 'unknown', delivery.id, JSON.stringify({ correlationId: delivery.correlation_id, assetId: asset.id })])
      await client.query('COMMIT')
      return NextResponse.json({ ok: true, assetId: asset.id, deliveryId: delivery.id })
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  } catch (error) { return apiErrorResponse(error) }
}

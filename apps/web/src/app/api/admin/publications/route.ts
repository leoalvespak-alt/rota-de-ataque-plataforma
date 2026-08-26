import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

const Status = z.enum(['idea', 'draft', 'ready', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'awaiting_manual_publish', 'cancelled'])
const Channel = z.enum(['instagram', 'threads'])
const Subtype = z.enum(['feed', 'reels', 'stories', 'carousel', 'threads', 'static'])

const ContentStructure = z.object({
  copy_principal: z.string().max(10_000).optional(),
  roteiro: z.string().max(10000).optional(),
  texto_arte: z.string().max(5_000).optional(),
  slides: z.array(z.object({ ordem: z.number().int().min(1), titulo: z.string().max(200), texto: z.string().max(2000) })).max(20).optional(),
  stories: z.array(z.object({ ordem: z.number().int().min(1), texto: z.string().max(2000), sticker: z.string().max(200).optional() })).max(30).optional(),
  legenda_longa: z.string().max(5000).optional(),
  observacoes: z.string().max(2000).optional(),
}).strict().nullable().optional()

const PublicationInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(180).nullable().optional(),
  caption: z.string().trim().max(4000).nullable().optional(),
  channel: Channel.optional(),
  subtype: Subtype.nullable().optional(),
  status: Status.optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
  locked_at: z.string().datetime().nullable().optional(),
  thesis_id: z.string().uuid().nullable().optional(),
  pillar: z.string().trim().max(160).nullable().optional(),
  format: z.string().trim().max(100).nullable().optional(),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(30).nullable().optional(),
  cta: z.string().trim().max(500).nullable().optional(),
  content_structure: ContentStructure,
  origin: z.enum(['manual', 'ai_generated', 'automation']).optional(),
  external_id: z.string().nullable().optional(),
}).strict()

const transitions: Record<string, string[]> = {
  idea: ['draft'],
  draft: ['ready', 'idea'],
  ready: ['approved', 'draft'],
  approved: ['scheduled', 'ready'],
  scheduled: ['approved', 'cancelled'],
  failed: ['scheduled', 'draft'],
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function copyData(input: z.infer<typeof PublicationInput>, previous?: unknown) {
  const value = { ...asObject(previous) }
  if (input.content_structure !== undefined) {
    for (const [key, item] of Object.entries(input.content_structure ?? {})) value[key] = item
  }
  if (input.hashtags !== undefined) value.hashtags = input.hashtags ?? []
  if (input.pillar !== undefined) value.pillar = input.pillar
  return JSON.stringify(value)
}

async function readCompatibility(client: { query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> }, id: string) {
  return (await client.query(`SELECT * FROM scheduled_publications_compat WHERE id=$1`, [id])).rows[0]
}

export async function POST(request: Request) {
  try {
    const user = await requireRole('operator')
    const parsed = PublicationInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success || parsed.data.id) return NextResponse.json({ error: 'invalid_request', traceId: crypto.randomUUID() }, { status: 400 })
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const { selected } = await getCampaignContext(client)
      if (!selected) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'campaign_not_found', traceId: crypto.randomUUID() }, { status: 409 })
      }
      const input = parsed.data
      const created = (await client.query<{ id: string }>(
        `INSERT INTO unified_creatives(
          campaign_id,title,caption,channel,format,status,scheduled_for,origin,
          thesis_id,cta,copy_data,curation_status,approved_by,external_id
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'approved',$12,$13)
        RETURNING id`,
        [selected.id, input.title ?? null, input.caption ?? null, input.channel ?? 'instagram', input.format ?? input.subtype ?? 'feed',
          input.status ?? 'idea', input.scheduled_for ?? null, input.origin ?? 'manual', input.thesis_id ?? null, input.cta ?? null,
          copyData(input), user.email ?? 'operator', input.external_id ?? null],
      )).rows[0]!
      const item = await readCompatibility(client, created.id)
      await client.query(
        `INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'publication.manual_created',$2,$3::jsonb)`,
        [user.email ?? 'operator', created.id, JSON.stringify(item)],
      )
      await client.query('COMMIT')
      return NextResponse.json({ item, traceId: crypto.randomUUID() }, { status: 201 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole('operator')
    const parsed = PublicationInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: 'invalid_request', traceId: crypto.randomUUID() }, { status: 400 })
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const before = (await client.query<Record<string, unknown>>(`SELECT * FROM unified_creatives WHERE id=$1 FOR UPDATE`, [parsed.data.id])).rows[0]
      if (!before) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'not_found', traceId: crypto.randomUUID() }, { status: 404 })
      }
      const input = parsed.data
      const previousStatus = String(before.status)
      const nextStatus = input.status ?? previousStatus
      if (nextStatus !== previousStatus && !(transitions[previousStatus] ?? []).includes(nextStatus)) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'invalid_state', traceId: crypto.randomUUID() }, { status: 409 })
      }
      const value = <T,>(key: string, supplied: T | undefined) => supplied === undefined ? before[key] as T : supplied
      const item = (await client.query<{ id: string }>(
        `UPDATE unified_creatives SET
          title=$2,caption=$3,channel=$4,format=$5,status=$6,scheduled_for=$7,
          thesis_id=$8,cta=$9,copy_data=$10::jsonb,locked_at=$11,external_id=$12
         WHERE id=$1 RETURNING id`,
        [input.id, value('title', input.title), value('caption', input.caption), value('channel', input.channel),
          input.format ?? input.subtype ?? value('format', undefined), nextStatus, value('scheduled_for', input.scheduled_for),
          value('thesis_id', input.thesis_id), value('cta', input.cta), copyData(input, before.copy_data), value('locked_at', input.locked_at), value('external_id', input.external_id)],
      )).rows[0]!
      const updated = await readCompatibility(client, item.id)
      await client.query(
        `INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'publication.manual_updated',$2,$3::jsonb,$4::jsonb)`,
        [user.email ?? 'operator', item.id, JSON.stringify(before), JSON.stringify(updated)],
      )
      await client.query('COMMIT')
      return NextResponse.json({ item: updated, traceId: crypto.randomUUID() })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}

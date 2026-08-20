import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDatabase } from '@plataforma/db'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

const Status = z.enum(['idea', 'draft', 'ready', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'awaiting_manual_publish', 'cancelled'])
const Channel = z.enum(['instagram', 'threads'])
const Subtype = z.enum(['feed', 'reels', 'stories', 'carousel', 'threads', 'static'])

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

export async function POST(request: Request) {
  try {
    const user = await requireRole('operator')
    const parsed = PublicationInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success || parsed.data.id) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const { selected } = await getCampaignContext(client)
      if (!selected) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'campaign_not_found' }, { status: 409 })
      }
      const input = parsed.data
      const item = (await client.query(
        `INSERT INTO scheduled_publications(
          campaign_id,title,caption,channel,subtype,status,scheduled_for,origin,locked_at,locked_by,
          thesis_id,pillar,format,hashtags,cta,curation_status,approved_by
        ) VALUES($1,$2,$3,$4,$5,$6,$7,'manual',$8,$9,$10,$11,$12,$13,$14,'approved',$9)
        RETURNING *,ig_media_id AS external_id`,
        [selected.id, input.title ?? null, input.caption ?? null, input.channel ?? 'instagram', input.subtype ?? null,
          input.status ?? 'idea', input.scheduled_for ?? null, input.locked_at ?? null, user.email ?? 'operator',
          input.thesis_id ?? null, input.pillar ?? null, input.format ?? null, input.hashtags ?? null, input.cta ?? null],
      )).rows[0]
      await client.query(
        `INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'publication.manual_created',$2,$3::jsonb)`,
        [user.email ?? 'operator', item.id, JSON.stringify(item)],
      )
      await client.query('COMMIT')
      return NextResponse.json({ item }, { status: 201 })
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
    if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SET LOCAL app.actor_type = 'human'")
      const before = (await client.query<Record<string, unknown>>(
        `SELECT * FROM scheduled_publications WHERE id=$1 FOR UPDATE`, [parsed.data.id],
      )).rows[0]
      if (!before) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      const input = parsed.data
      const previousStatus = String(before.status)
      const nextStatus = input.status ?? previousStatus
      if (nextStatus !== previousStatus && !(transitions[previousStatus] ?? []).includes(nextStatus)) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'invalid_state' }, { status: 409 })
      }
      const value = <T,>(key: string, supplied: T | undefined) => supplied === undefined ? before[key] : supplied
      const item = (await client.query(
        `UPDATE scheduled_publications SET
          title=$2,caption=$3,channel=$4,subtype=$5,status=$6,scheduled_for=$7,locked_at=$8,
          locked_by=CASE WHEN $8::timestamptz IS NULL THEN NULL ELSE $9 END,thesis_id=$10,pillar=$11,format=$12,hashtags=$13,cta=$14
         WHERE id=$1 RETURNING *,ig_media_id AS external_id`,
        [input.id, value('title', input.title), value('caption', input.caption), value('channel', input.channel),
          value('subtype', input.subtype), nextStatus, value('scheduled_for', input.scheduled_for), value('locked_at', input.locked_at),
          user.email ?? 'operator', value('thesis_id', input.thesis_id), value('pillar', input.pillar), value('format', input.format),
          value('hashtags', input.hashtags), value('cta', input.cta)],
      )).rows[0]
      await client.query(
        `INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'publication.manual_updated',$2,$3::jsonb,$4::jsonb)`,
        [user.email ?? 'operator', item.id, JSON.stringify(before), JSON.stringify(item)],
      )
      await client.query('COMMIT')
      return NextResponse.json({ item })
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

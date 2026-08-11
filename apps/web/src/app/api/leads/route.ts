import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const QuerySchema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50), minScore: z.coerce.number().min(0).max(100).optional(), priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(), intent: z.string().trim().max(80).optional(), publicOnly: z.enum(['true', 'false']).optional() })
type Cursor = { score: number; rank: number; id: string }
const decodeCursor = (value?: string): Cursor | undefined => value ? JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor : undefined
const encodeCursor = (value: Cursor) => Buffer.from(JSON.stringify(value)).toString('base64url')

export async function GET(request: Request) {
  await requireRole('viewer')
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query', issues: parsed.error.flatten() }, { status: 400 })
  let cursor: Cursor | undefined
  try { cursor = decodeCursor(parsed.data.cursor) } catch { return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 }) }
  const { limit, minScore, priority, intent, publicOnly } = parsed.data
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const result = await pool.query(`WITH ranked AS (
      SELECT l.id,l.username_current,l.profile_url,l.last_seen_at,lp.is_private,lp.is_verified,lp.has_profile_pic,
        ls.final_score,ls.priority,ls.intent_score,ls.relationship_score,ls.computed_at,
        CASE ls.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END priority_rank,
        COALESCE(array_remove(array_agg(DISTINCT cc.intent),NULL),'{}') intents,
        COALESCE(array_remove(array_agg(DISTINCT src.source_kind),NULL),'{}') sources
      FROM leads l JOIN lead_scores ls ON ls.lead_id=l.id LEFT JOIN lead_profile lp ON lp.lead_id=l.id
      LEFT JOIN lead_sources src ON src.lead_id=l.id LEFT JOIN comment_classification cc ON cc.comment_id=src.comment_id
      WHERE ($1::numeric IS NULL OR ls.final_score >= $1) AND ($2::text IS NULL OR ls.priority=$2)
        AND ($3::text IS NULL OR cc.intent=$3) AND ($4::boolean IS NULL OR $4=false OR COALESCE(lp.is_private,false)=false)
      GROUP BY l.id,lp.lead_id,ls.lead_id,ls.campaign_id
    ) SELECT * FROM ranked WHERE ($5::numeric IS NULL OR final_score < $5 OR (final_score=$5 AND priority_rank>$6) OR (final_score=$5 AND priority_rank=$6 AND id>$7::uuid))
      ORDER BY final_score DESC,priority_rank ASC,id ASC LIMIT $8`, [minScore ?? null, priority ?? null, intent ?? null, publicOnly ? publicOnly === 'true' : null, cursor?.score ?? null, cursor?.rank ?? null, cursor?.id ?? null, limit + 1])
    const hasMore = result.rows.length > limit
    const items = result.rows.slice(0, limit)
    const last = items.at(-1)
    return NextResponse.json({ items, nextCursor: hasMore && last ? encodeCursor({ score: Number(last.final_score), rank: last.priority_rank, id: last.id }) : null })
  } finally { await pool.end() }
}

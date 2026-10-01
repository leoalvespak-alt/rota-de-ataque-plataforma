import { createDatabase } from '@plataforma/db'
import { canonicalPautaKey } from '@plataforma/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

const ManualInput = z.object({
  title: z.string().trim().min(1).max(500),
  categoria: z.string().trim().max(60).nullish(),
  estado: z.string().trim().max(2).nullish(),
  fase_ciclo: z.string().trim().max(60).nullish(),
  sourceUrl: z.string().trim().max(2000).nullish(),
}).strict()

export async function GET() {
  try { await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const rows = await pool.query(
      `SELECT canonical_key, categoria, estado, fase_ciclo, title, status,
              jsonb_array_length(sources) AS sources, first_seen_at, last_seen_at
       FROM editorial.pauta_registry ORDER BY last_seen_at DESC LIMIT 300`,
    )
    return NextResponse.json({ items: rows.rows })
  } catch (error) { return apiErrorResponse(error) }
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = ManualInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse('invalid_request')
  const key = canonicalPautaKey({
    categoria: parsed.data.categoria,
    estado: parsed.data.estado,
    fase_ciclo: parsed.data.fase_ciclo,
    title: parsed.data.title,
  })
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const row = (await pool.query(
      `INSERT INTO editorial.pauta_registry(canonical_key,categoria,estado,fase_ciclo,title,status,sources)
       VALUES($1,$2,$3,$4,$5,'manual',$6::jsonb)
       ON CONFLICT (canonical_key) DO UPDATE SET
         status = 'manual', last_seen_at = now(), updated_at = now(),
         sources = editorial.pauta_registry.sources || EXCLUDED.sources
       RETURNING canonical_key, status`,
      [
        key,
        parsed.data.categoria ?? null,
        parsed.data.estado?.toUpperCase() ?? null,
        parsed.data.fase_ciclo ?? null,
        parsed.data.title,
        JSON.stringify([{ url: parsed.data.sourceUrl ?? null, source_name: 'manual', by: user.email ?? 'unknown' }]),
      ],
    )).rows[0]
    await pool.query(
      `INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'pauta.manual',$2,$3::jsonb)`,
      [user.email ?? 'unknown', key, JSON.stringify({ title: parsed.data.title })],
    )
    return NextResponse.json({ item: row }, { status: 201 })
  } catch (error) { return apiErrorResponse(error) }
}

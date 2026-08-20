import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const Body = z.object({ scope: z.enum(['global', 'provider', 'campaign']), scopeId: z.string().min(1).max(100), period: z.enum(['daily', 'monthly']), limitUsd: z.number().min(0).max(100000) }).strict()
export async function GET() {
  await requireRole('viewer')
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const budgets = await pool.query(`SELECT * FROM organic_budgets ORDER BY period_started_at DESC, scope, scope_id`)
    return NextResponse.json({ budgets: budgets.rows })
  } finally {}
}
export async function PUT(request: Request) {
  const user = await requireRole('admin')
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_budget' }, { status: 400 })
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const periodStart = parsed.data.period === 'daily' ? 'current_date' : "date_trunc('month',now())"
    const before = (await pool.query(`SELECT * FROM organic_budgets WHERE scope=$1 AND scope_id=$2 AND period=$3 AND period_started_at=${periodStart}`, [parsed.data.scope, parsed.data.scopeId, parsed.data.period])).rows[0]
    const budget = (await pool.query(`INSERT INTO organic_budgets(scope,scope_id,period,limit_usd,period_started_at) VALUES($1,$2,$3,$4,${periodStart})
      ON CONFLICT(scope,scope_id,period,period_started_at) DO UPDATE SET limit_usd=EXCLUDED.limit_usd RETURNING *`, [parsed.data.scope, parsed.data.scopeId, parsed.data.period, parsed.data.limitUsd])).rows[0]
    await pool.query(`INSERT INTO audit_log(actor_id,action,target,before,after) VALUES($1,'organic_budget.change',$2,$3::jsonb,$4::jsonb)`, [user.email ?? 'unknown', `${parsed.data.scope}:${parsed.data.scopeId}:${parsed.data.period}`, JSON.stringify(before ?? null), JSON.stringify(budget)])
    return NextResponse.json({ budget })
  } finally {}
}

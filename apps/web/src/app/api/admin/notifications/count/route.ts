import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse } from '@/lib/api-errors'

export async function GET() {
  try {
    await requireRole('admin')
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    try {
      const result = await pool.query<{ count: number; id: string; message: string; created_at: string }>(
        `SELECT
          (SELECT COUNT(*)::int FROM alerts WHERE resolved_at IS NULL) AS count,
          a.id, a.kind AS message, a.created_at
         FROM alerts a
         WHERE a.resolved_at IS NULL
         ORDER BY a.created_at DESC
         LIMIT 5`
      )
      const count = result.rows[0]?.count ?? 0
      const recent = result.rows.map(row => ({
        id: row.id,
        message: row.message,
        created_at: row.created_at,
      }))
      return NextResponse.json({ count, recent })
    } finally {}
  } catch (error) {
    return apiErrorResponse(error)
  }
}

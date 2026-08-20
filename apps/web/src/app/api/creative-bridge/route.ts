import { NextResponse } from 'next/server'
import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse } from '@/lib/api-errors'

export async function GET() {
  try {
    await requireRole('operator')
    const { pool } = createDatabase(process.env.DATABASE_URL!)
    try {
    const deliveries = (await pool.query(`SELECT delivery.id,delivery.content_item_id,delivery.variant_id,delivery.schema_version,delivery.correlation_id,delivery.payload,delivery.status,delivery.created_at,delivery.updated_at
      FROM creative_bridge_deliveries delivery ORDER BY delivery.created_at DESC LIMIT 100`)).rows
      return NextResponse.json({ deliveries })
    } finally {}
  } catch (error) { return apiErrorResponse(error) }
}

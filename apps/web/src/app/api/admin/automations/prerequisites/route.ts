/**
 * GET /api/admin/automations/prerequisites
 *
 * Avalia cada PrerequisiteKey contra o banco e retorna o status de satisfação.
 * Papel mínimo: viewer.
 *
 * GARANTIA: rota nova, adicionada em paralelo. Nenhum endpoint existente é modificado.
 */

import { createDatabase } from '@plataforma/db'
import { Redis } from 'ioredis'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { evaluateAutomationPrerequisites } from '@/lib/automation-prerequisites'
import { requireRole } from '@/lib/permissions'

export async function GET() {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 })
  try {
    const prerequisites = await evaluateAutomationPrerequisites(pool, redis)
    return NextResponse.json({ prerequisites })
  } catch (error) {
    return apiErrorResponse(error)
  } finally {
    await redis.quit().catch(() => undefined)
  }
}

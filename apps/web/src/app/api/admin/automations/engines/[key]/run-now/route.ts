/**
 * POST /api/admin/automations/engines/[key]/run-now
 *
 * Enfileira run_now para todos os workers schedulable do motor especificado.
 * Papel mínimo: operator.
 *
 * GARANTIA: rota nova. Reutiliza o mapa de payloads do route.ts existente.
 */

import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import { ENGINE_BY_KEY, type EngineKey } from '@plataforma/shared'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'

const VALID_ENGINE_KEYS = new Set(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'])

// Mapa de payloads reutilizado do route.ts existente (passo 3.4)
function getPayloadForWorker(workerName: string, campaignId?: string): Record<string, unknown> {
  const payloads: Record<string, Record<string, unknown> | undefined> = {
    'news-radar':       { mode: 'incremental' },
    'data-quality':     { refreshViews: true },
    'competitive-intel':{ windowDays: 30 },
    'reddit-intelligence': {},
    'publisher':        {},
    'threads-publisher':{},
    'email-flow-engine':{ limit: 100 },
    'adaptive-crawler': {},
    'community-map':    {},
    'content-opportunity': campaignId ? { campaignId, limit: 25 } : {},
  }
  return payloads[workerName] ?? {}
}

export async function POST(
  request: Request,
  { params }: { params: { key: string } },
) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }

  const { key } = params
  if (!VALID_ENGINE_KEYS.has(key)) {
    return NextResponse.json({ error: 'engine_not_found' }, { status: 404 })
  }
  const engineKey = key as EngineKey
  const engine = ENGINE_BY_KEY[engineKey]

  // Apenas workers schedulable
  const schedulableWorkers = engine.workers.filter((w: string) => {
    // Verificar na lista de workers schedulables conhecida
    const SCHEDULABLE = new Set([
      'news-radar', 'competitive-intel', 'data-quality', 'community-map',
      'reddit-intelligence', 'email-flow-engine', 'adaptive-crawler', 'publisher', 'threads-publisher',
    ])
    return SCHEDULABLE.has(w)
  })

  if (schedulableWorkers.length === 0) {
    return NextResponse.json({
      error: 'no_schedulable_workers',
      message: `Motor ${engineKey} nao possui workers com agendamento proprio gerenciavel.`,
    }, { status: 422 })
  }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)

  try {
    const { selected } = await getCampaignContext(pool)
    const campaignId = selected?.id

    const enqueued: string[] = []
    const failed: string[] = []

    for (const workerName of schedulableWorkers) {
      try {
        const queue = registry.queues[workerName as keyof typeof registry.queues]
        if (!queue) { failed.push(workerName); continue }

        const payload = getPayloadForWorker(workerName, campaignId)
        const job = await queue.add(`${workerName}-manual`, { ...payload, manual: true, triggeredBy: user.email })

        await pool.query(
          `INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, $2, $3, $4::jsonb)`,
          [user.email ?? 'operator', 'engine.run_now', engineKey, JSON.stringify({ workerName, jobId: job.id })],
        )
        enqueued.push(workerName)
      } catch {
        failed.push(workerName)
      }
    }

    return NextResponse.json({ ok: true, engineKey, enqueued, failed })
  } finally {
    await registry.connection.quit()
  }
}

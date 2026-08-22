/**
 * /api/admin/automations/engines — GET + POST
 *
 * GET:  retorna estado agregado dos 7 motores (papel mínimo: viewer).
 * POST: ativa/desativa motor com cascata (papel mínimo: operator).
 *
 * GARANTIA: rota nova, adicionada em paralelo.
 * A rota existente /api/admin/automations (GET/POST por worker) permanece intacta.
 */

import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import {
  AUTOMATION_ENGINES,
  ENGINE_BY_KEY,
  resolveEnableCascade,
  resolveDisableCascade,
  type EngineKey,
  type EngineState,
} from '@plataforma/shared'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface WorkerRow {
  worker_name: string
  enabled: boolean
  engine_key: string | null
  schedulable: boolean
  label_pt: string | null
  last_error: string | null
  heartbeat_state: string | null
}

async function evaluatePrerequisites(
  pool: any,
  engineKey: EngineKey,
): Promise<Array<{ key: string; satisfied: boolean; label_pt: string; href: string }>> {
  const engine = ENGINE_BY_KEY[engineKey]
  if (engine.prerequisites.length === 0) return []

  const { rows } = await pool.query(`
    SELECT
      EXISTS(SELECT 1 FROM news_sources WHERE active = true LIMIT 1)   AS has_sources,
      EXISTS(SELECT 1 FROM theses LIMIT 1)                              AS has_theses,
      EXISTS(SELECT 1 FROM accounts WHERE role = 'actor' AND status = 'HEALTHY' LIMIT 1) AS has_actor,
      EXISTS(SELECT 1 FROM contact_policies LIMIT 1)                   AS has_policy,
      COALESCE((SELECT (value->>'enabled')::boolean FROM ai_settings WHERE key = 'global' LIMIT 1), true) AS has_ai,
      COALESCE((SELECT (value->>'kill_switch')::boolean FROM operational_settings WHERE key = 'global' LIMIT 1), false) AS kill_switch,
      EXISTS(SELECT 1 FROM content_variants WHERE status = 'approved' LIMIT 1) AS has_approved_variant
  `)
  const d = (rows[0] ?? {
    has_sources: false, has_theses: false, has_actor: false,
    has_policy: false, has_ai: true, kill_switch: false, has_approved_variant: false,
  }) as {
    has_sources: boolean; has_theses: boolean; has_actor: boolean;
    has_policy: boolean; has_ai: boolean; kill_switch: boolean; has_approved_variant: boolean
  }

  const LABEL_MAP: Record<string, { label_pt: string; href: string }> = {
    news_source_active:        { label_pt: 'Pelo menos 1 fonte de noticias ativa',      href: '/configuracoes?aba=contas' },
    connected_account_healthy: { label_pt: 'Conta social conectada e saudavel',         href: '/configuracoes?aba=contas' },
    embeddings_healthy:        { label_pt: 'Servico de embeddings ativo',               href: '/configuracoes?aba=saude' },
    ai_provider_configured:    { label_pt: 'Provedor de IA configurado',                href: '/configuracoes?aba=ia' },
    thesis_exists:             { label_pt: 'Pelo menos 1 tese editorial cadastrada',    href: '/conteudo?aba=teses' },
    actor_account_healthy:     { label_pt: 'Conta com papel actor saudavel',            href: '/configuracoes?aba=contas' },
    kill_switch_off:           { label_pt: 'Kill-switch global desligado',              href: '/automacoes?aba=motores' },
    approved_variant_exists:   { label_pt: 'Pelo menos 1 variante aprovada',           href: '/conteudo?aba=funil' },
    contact_policy_configured: { label_pt: 'Politicas de contato definidas',           href: '/relacionamento?aba=politicas' },
    budget_ceiling_set:        { label_pt: 'Teto de orcamento definido',               href: '/desempenho?aba=orcamento' },
  }

  return engine.prerequisites.map((key: string) => {
    let satisfied = true
    switch (key) {
      case 'news_source_active':        satisfied = d.has_sources; break
      case 'connected_account_healthy': satisfied = d.has_actor; break
      case 'embeddings_healthy':        satisfied = true; break
      case 'ai_provider_configured':    satisfied = d.has_ai !== false; break
      case 'thesis_exists':             satisfied = d.has_theses; break
      case 'actor_account_healthy':     satisfied = d.has_actor; break
      case 'kill_switch_off':           satisfied = !d.kill_switch; break
      case 'approved_variant_exists':   satisfied = d.has_approved_variant; break
      case 'contact_policy_configured': satisfied = d.has_policy; break
      case 'budget_ceiling_set':        satisfied = true; break
    }
    return { key, satisfied, ...(LABEL_MAP[key] ?? { label_pt: key, href: '/configuracoes' }) }
  })
}

// ---------------------------------------------------------------------------
// GET /api/admin/automations/engines
// ---------------------------------------------------------------------------

export async function GET() {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)

  try {
    const res1 = await pool.query(`
      SELECT
        ws.worker_name,
        ws.enabled,
        ws.engine_key,
        ws.schedulable,
        ws.label_pt,
        ws.last_error,
        wh.state AS heartbeat_state
      FROM worker_settings ws
      LEFT JOIN LATERAL (
        SELECT state
        FROM worker_heartbeats
        WHERE worker = ws.worker_name
        ORDER BY last_beat_at DESC
        LIMIT 1
      ) wh ON true
    `)
    const workers = res1.rows as WorkerRow[]

    // Contagens BullMQ por fila
    const queueCounts: Record<string, { waiting: number; active: number; failed: number }> = {}
    await Promise.all(
      workers.map(async (w) => {
        try {
          const queue = registry.queues[w.worker_name as keyof typeof registry.queues]
          if (!queue) { queueCounts[w.worker_name] = { waiting: 0, active: 0, failed: 0 }; return }
          const counts = await queue.getJobCounts('waiting', 'active', 'failed')
          queueCounts[w.worker_name] = { waiting: counts.waiting ?? 0, active: counts.active ?? 0, failed: counts.failed ?? 0 }
        } catch {
          queueCounts[w.worker_name] = { waiting: 0, active: 0, failed: 0 }
        }
      }),
    )

    const engines = AUTOMATION_ENGINES.map((engine: any) => {
      const engineWorkers = workers.filter((w) => w.engine_key === engine.key)
      const enabledCount = engineWorkers.filter((w) => w.enabled).length
      const totalCount = engine.workers.length

      const queueAgg = engineWorkers.reduce(
        (acc, w) => {
          const c = queueCounts[w.worker_name] ?? { waiting: 0, active: 0, failed: 0 }
          return { waiting: acc.waiting + c.waiting, active: acc.active + c.active, failed: acc.failed + c.failed }
        },
        { waiting: 0, active: 0, failed: 0 },
      )

      const divergences = engineWorkers
        .filter((w) => (w.enabled && w.heartbeat_state !== 'running') || (!w.enabled && w.heartbeat_state === 'running'))
        .map((w) => ({ worker: w.worker_name, label: w.label_pt ?? w.worker_name, kind: w.enabled ? 'configured_but_not_running' : 'running_but_disabled' }))

      let state: EngineState = 'off'
      if (engineWorkers.some((w) => w.last_error) || queueAgg.failed > 0) state = 'error'
      else if (divergences.length > 0 || (enabledCount > 0 && enabledCount < totalCount)) state = 'attention'
      else if (enabledCount === totalCount && engineWorkers.every((w) => w.heartbeat_state === 'running')) state = 'on'
      else if (enabledCount === totalCount) state = 'starting'

      return {
        key: engine.key,
        slug: engine.slug,
        name_pt: engine.name_pt,
        description_pt: engine.description_pt,
        alwaysOn: engine.alwaysOn,
        dependsOn: engine.dependsOn,
        state,
        enabledWorkers: enabledCount,
        totalWorkers: totalCount,
        queue: queueAgg,
        divergences,
      }
    })

    return NextResponse.json({ engines })
  } finally {
    await registry.connection.quit()
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/automations/engines
// ---------------------------------------------------------------------------

const EngineActionSchema = z.object({
  engineKey: z.enum(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'] as [EngineKey, ...EngineKey[]]),
  action: z.enum(['enable', 'disable']),
  cascade: z.boolean().default(false),
})

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try { user = await requireRole('operator') } catch (error) { return apiErrorResponse(error) }

  const parsed = EngineActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse()

  const { engineKey, action, cascade } = parsed.data

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)

  try {
    // Verificar pré-requisitos para enable
    if (action === 'enable') {
      const prereqs = await evaluatePrerequisites(pool, engineKey)
      const unsatisfied = prereqs.filter((p) => !p.satisfied)
      if (unsatisfied.length > 0) {
        return NextResponse.json({ error: 'prerequisites_not_met', prerequisites: unsatisfied }, { status: 409 })
      }
    }

    // Resolver cascata
    let engineKeys: EngineKey[]
    if (action === 'enable') {
      const deps = resolveEnableCascade(engineKey)
      if (deps.length > 0 && !cascade) {
        return NextResponse.json({
          error: 'cascade_required',
          message: 'Este motor tem dependencias que precisam ser ligadas primeiro. Reenvie com cascade: true.',
          dependencies: deps,
        }, { status: 409 })
      }
      engineKeys = [...deps, engineKey]
    } else {
      const affected = resolveDisableCascade(engineKey)
      if (affected.length > 0 && !cascade) {
        return NextResponse.json({
          error: 'cascade_required',
          message: 'Desligar este motor afeta outros motores que dependem dele. Reenvie com cascade: true.',
          affected,
        }, { status: 409 })
      }
      engineKeys = [engineKey, ...affected]
    }

    const enabledValue = action === 'enable'
    const allWorkerNames = engineKeys.flatMap((k) => ENGINE_BY_KEY[k].workers)

    // Idempotência
    const res2 = await pool.query(
      `SELECT worker_name, enabled FROM worker_settings WHERE worker_name = ANY($1)`,
      [allWorkerNames],
    )
    const currentState = res2.rows as Array<{ worker_name: string; enabled: boolean }>
    const changed: string[] = currentState.filter((w) => w.enabled !== enabledValue).map((w) => w.worker_name)
    if (changed.length === 0) {
      return NextResponse.json({ ok: true, action, engineKey, changed: [] })
    }

    // Transação única
    await pool.query('BEGIN')
    try {
      await pool.query(
        `UPDATE worker_settings SET enabled = $1, updated_at = now() WHERE worker_name = ANY($2)`,
        [enabledValue, changed],
      )

      const res3 = await pool.query(
        `INSERT INTO engine_commands(engine_key, action, workers_affected, cascade, requested_by, status)
         VALUES($1, $2, $3, $4, $5, 'completed') RETURNING id`,
        [engineKey, action, changed, cascade, user.email ?? null],
      )
      const ecRows = res3.rows as Array<{ id: string }>
      const engineCommandId = ecRows[0]?.id

      for (const workerName of changed) {
        await pool.query(
          `INSERT INTO worker_commands(worker_name, command_type, payload, requested_by)
           VALUES($1, $2, $3::jsonb, $4)`,
          [workerName, action, JSON.stringify({ engineKey, engineCommandId, cascade }), user.email ?? null],
        )
      }

      await pool.query(
        `INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, $2, $3, $4::jsonb)`,
        [user.email ?? 'operator', `engine.${action}`, engineKey, JSON.stringify({ engineCommandId, cascade, changed })],
      )

      await pool.query('COMMIT')
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }

    return NextResponse.json({ ok: true, action, engineKey, cascade, changed, enginesAffected: engineKeys })
  } finally {
    await registry.connection.quit()
  }
}

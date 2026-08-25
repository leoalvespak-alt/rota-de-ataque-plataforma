import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import {
  AUTOMATION_ENGINES,
  ENGINE_BY_KEY,
  parseCadenceLabel,
  resolveDisableCascade,
  resolveEnableCascade,
  type EngineKey,
  type EngineState,
} from '@plataforma/shared'
import { Redis } from 'ioredis'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'
import { evaluateAutomationPrerequisites } from '@/lib/automation-prerequisites'
import { requireRole } from '@/lib/permissions'

interface WorkerRow {
  worker_name: string
  enabled: boolean
  engine_key: string | null
  schedulable: boolean
  label_pt: string | null
  cadence: string | null
  last_error: string | null
  heartbeat_state: string | null
  last_beat_at: string | null
  last_run_state: string | null
  last_run_reason_code: string | null
  last_run_finished_at: string | null
  last_success_at: string | null
  updated_at: string
}

interface WorkerStateRow {
  worker_name: string
  enabled: boolean
}

const EngineActionSchema = z.object({
  engineKey: z.enum(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']),
  action: z.enum(['enable', 'disable']),
  cascade: z.boolean().default(false),
}).strict()

async function closeQueueRegistry(registry: ReturnType<typeof createQueueRegistry>) {
  await Promise.allSettled(Object.values(registry.queues).map((queue) => queue.close()))
  await registry.connection.quit().catch(() => undefined)
}

async function queueCountsWithTimeout(queue: { getJobCounts(...types: string[]): Promise<Record<string, number>> }) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      queue.getJobCounts('waiting', 'active', 'failed'),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('queue_timeout')), 3_000) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function engineFullyEnabled(engineKey: EngineKey, state: Map<string, boolean>) {
  return ENGINE_BY_KEY[engineKey].workers.every((workerName) => state.get(workerName) === true)
}

function engineHasEnabledWorker(engineKey: EngineKey, state: Map<string, boolean>) {
  return ENGINE_BY_KEY[engineKey].workers.some((workerName) => state.get(workerName) === true)
}

export async function GET() {
  try {
    await requireRole('viewer')
  } catch (error) {
    return apiErrorResponse(error)
  }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)
  try {
    const [{ rows }, prerequisites] = await Promise.all([
      pool.query<WorkerRow>(`
        SELECT
          ws.worker_name,
          ws.enabled,
          ws.engine_key,
          ws.schedulable,
          ws.label_pt,
          ws.cadence,
          ws.last_error,
          ws.last_success_at,
          ws.updated_at,
          heartbeat.state AS heartbeat_state,
          heartbeat.last_beat_at::text AS last_beat_at,
          last_run.result_state AS last_run_state,
          last_run.reason_code AS last_run_reason_code,
          last_run.finished_at::text AS last_run_finished_at
        FROM worker_settings ws
        LEFT JOIN LATERAL (
          SELECT state, last_beat_at
          FROM worker_heartbeats
          WHERE worker = ws.worker_name
          ORDER BY last_beat_at DESC
          LIMIT 1
        ) heartbeat ON true
        LEFT JOIN LATERAL (
          SELECT result_state, reason_code, finished_at
          FROM worker_runs
          WHERE worker_name = ws.worker_name
          ORDER BY started_at DESC
          LIMIT 1
        ) last_run ON true
      `),
      evaluateAutomationPrerequisites(pool, registry.connection),
    ])
    const workerByName = new Map(rows.map((worker) => [worker.worker_name, worker]))
    const currentState = new Map(rows.map((worker) => [worker.worker_name, worker.enabled]))
    const prerequisiteByKey = new Map(prerequisites.map((item) => [item.key, item]))
    const queueCounts: Record<string, { waiting: number; active: number; failed: number }> = {}
    const unavailableQueues = new Set<string>()

    await Promise.all(AUTOMATION_ENGINES.flatMap((engine) => engine.workers).map(async (workerName) => {
      try {
        const counts = await queueCountsWithTimeout(registry.queues[workerName])
        queueCounts[workerName] = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          failed: counts.failed ?? 0,
        }
      } catch {
        unavailableQueues.add(workerName)
      }
    }))

    const engines = AUTOMATION_ENGINES.map((engine) => {
      const engineWorkers = engine.workers.map((workerName) => workerByName.get(workerName)).filter(Boolean) as WorkerRow[]
      const enabledCount = engineWorkers.filter((worker) => worker.enabled).length
      const queue = engine.workers.reduce((total, workerName) => {
        const counts = queueCounts[workerName] ?? { waiting: 0, active: 0, failed: 0 }
        return {
          waiting: total.waiting + counts.waiting,
          active: total.active + counts.active,
          failed: total.failed + counts.failed,
        }
      }, { waiting: 0, active: 0, failed: 0 })
      const divergences = engine.workers.flatMap((workerName) => {
        const worker = workerByName.get(workerName)
        if (!worker) return [{ worker: workerName, label: workerName, kind: 'missing_worker_setting' }]
        if (worker.engine_key !== engine.key) return [{ worker: workerName, label: worker.label_pt ?? workerName, kind: 'engine_mapping_mismatch' }]
        if (worker.enabled && worker.heartbeat_state !== 'running') return [{ worker: workerName, label: worker.label_pt ?? workerName, kind: 'configured_but_not_running' }]
        if (!worker.enabled && worker.heartbeat_state === 'running') return [{ worker: workerName, label: worker.label_pt ?? workerName, kind: 'running_but_disabled' }]
        return []
      })
      const allEnabled = enabledCount === engine.workers.length
      const allRunning = engineWorkers.length === engine.workers.length
        && engineWorkers.every((worker) => worker.heartbeat_state === 'running')
      const recentlyEnabled = allEnabled && engineWorkers.some((worker) => (
        Date.now() - new Date(worker.updated_at).getTime() < 120_000
      ))
      const latestRun = engineWorkers
        .filter((worker) => worker.last_run_finished_at)
        .sort((left, right) => new Date(right.last_run_finished_at!).getTime() - new Date(left.last_run_finished_at!).getTime())[0]
      let state: EngineState = 'off'
      if (enabledCount === 0) state = 'off'
      else if (allEnabled && allRunning && latestRun?.last_run_state === 'failed') state = 'error'
      else if (allEnabled && allRunning) state = 'on'
      else if (recentlyEnabled) state = 'starting'
      else if (divergences.length > 0 || (enabledCount > 0 && !allEnabled)) state = 'attention'

      const cadenceWorker = engineWorkers.find((worker) => worker.schedulable && worker.cadence)
      return {
        key: engine.key,
        slug: engine.slug,
        name_pt: engine.name_pt,
        description_pt: engine.description_pt,
        alwaysOn: engine.alwaysOn,
        dependsOn: engine.dependsOn,
        enableCascade: resolveEnableCascade(engine.key).filter((key) => !engineFullyEnabled(key, currentState)),
        disableCascade: resolveDisableCascade(engine.key).filter((key) => engineHasEnabledWorker(key, currentState)),
        state,
        desiredState: allEnabled ? 'on' : enabledCount > 0 ? 'on_partial' : 'off',
        runtimeState: engineWorkers.length === engine.workers.length && engineWorkers.every((worker) => worker.last_beat_at && Date.now() - new Date(worker.last_beat_at).getTime() <= 90_000)
          ? allRunning ? 'running' : engineWorkers.every((worker) => worker.heartbeat_state === 'paused') ? 'paused' : 'starting'
          : 'absent',
        lastRunState: latestRun?.last_run_state ?? 'never',
        lastSuccessAt: engineWorkers.map((worker) => worker.last_success_at).filter(Boolean).sort().at(-1) ?? null,
        enabledWorkers: enabledCount,
        totalWorkers: engine.workers.length,
        cadence: cadenceWorker?.cadence ? parseCadenceLabel(cadenceWorker.cadence) : null,
        queue,
        queueAvailable: engine.workers.every((workerName) => !unavailableQueues.has(workerName)),
        divergences,
        prerequisites: engine.prerequisites.map((key) => prerequisiteByKey.get(key)).filter(Boolean),
        workers: engine.workers.map((workerName) => {
          const worker = workerByName.get(workerName)
          return {
            worker_name: workerName,
            label_pt: worker?.label_pt ?? workerName,
            enabled: worker?.enabled ?? false,
            schedulable: worker?.schedulable ?? false,
            heartbeat_state: worker?.heartbeat_state ?? null,
            last_beat_at: worker?.last_beat_at ?? null,
            last_run_state: worker?.last_run_state ?? 'never',
            last_run_reason_code: worker?.last_run_reason_code ?? null,
          }
        }),
      }
    })

    return NextResponse.json({
      engines,
      providerAvailable: unavailableQueues.size === 0,
    })
  } catch (error) {
    return apiErrorResponse(error)
  } finally {
    await closeQueueRegistry(registry)
  }
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole('operator')
  } catch (error) {
    return apiErrorResponse(error)
  }

  const parsed = EngineActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse()
  const { engineKey, action, cascade } = parsed.data
  const typedEngineKey = engineKey as EngineKey
  const engine = ENGINE_BY_KEY[typedEngineKey]
  if (action === 'disable' && engine.alwaysOn) {
    return NextResponse.json({ error: 'always_on_engine' }, { status: 409 })
  }

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const relatedKeys = action === 'enable'
    ? [...resolveEnableCascade(typedEngineKey), typedEngineKey]
    : [typedEngineKey, ...resolveDisableCascade(typedEngineKey)]
  const relatedWorkers = relatedKeys.flatMap((key) => ENGINE_BY_KEY[key].workers)

  try {
    const currentResult = await pool.query<WorkerStateRow>(
      'SELECT worker_name, enabled FROM worker_settings WHERE worker_name = ANY($1)',
      [relatedWorkers],
    )
    const currentState = new Map(currentResult.rows.map((worker) => [worker.worker_name, worker.enabled]))
    const missingWorkers = relatedWorkers.filter((workerName) => !currentState.has(workerName))
    if (missingWorkers.length > 0) {
      return NextResponse.json({ error: 'worker_catalog_mismatch', missingWorkers }, { status: 409 })
    }

    let engineKeys: EngineKey[]
    if (action === 'enable') {
      const dependencies = resolveEnableCascade(typedEngineKey)
        .filter((key) => !engineFullyEnabled(key, currentState))
      if (dependencies.length > 0 && !cascade) {
        return NextResponse.json({ error: 'cascade_required', dependencies }, { status: 409 })
      }
      engineKeys = [...(cascade ? dependencies : []), typedEngineKey]

      const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 })
      try {
        const prerequisiteResults = await evaluateAutomationPrerequisites(pool, redis)
        const prerequisiteByKey = new Map(prerequisiteResults.map((item) => [item.key, item]))
        const unsatisfied = engineKeys.flatMap((key) => ENGINE_BY_KEY[key].prerequisites
          .map((prerequisiteKey) => prerequisiteByKey.get(prerequisiteKey))
          .filter((item) => item && !item.satisfied)
          .map((item) => ({ ...item!, engineKey: key })))
        if (unsatisfied.length > 0) {
          return NextResponse.json({ error: 'prerequisites_not_met', prerequisites: unsatisfied }, { status: 409 })
        }
      } finally {
        await redis.quit().catch(() => undefined)
      }
    } else {
      const affected = resolveDisableCascade(typedEngineKey)
        .filter((key) => engineHasEnabledWorker(key, currentState))
      if (affected.length > 0 && !cascade) {
        return NextResponse.json({ error: 'cascade_required', affected }, { status: 409 })
      }
      engineKeys = [typedEngineKey, ...(cascade ? affected : [])]
    }

    const workerNames = engineKeys.flatMap((key) => ENGINE_BY_KEY[key].workers)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query<WorkerStateRow>(
        'SELECT worker_name, enabled FROM worker_settings WHERE worker_name = ANY($1) FOR UPDATE',
        [workerNames],
      )
      if (locked.rows.length !== workerNames.length) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'worker_catalog_mismatch' }, { status: 409 })
      }
      const enabledValue = action === 'enable'
      const changed = locked.rows
        .filter((worker) => worker.enabled !== enabledValue)
        .map((worker) => worker.worker_name)
      if (changed.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ ok: true, action, engineKey: typedEngineKey, changed: [] })
      }

      await client.query(
        'UPDATE worker_settings SET enabled = $1, updated_at = now() WHERE worker_name = ANY($2)',
        [enabledValue, changed],
      )
      const command = await client.query<{ id: string }>(`
        INSERT INTO engine_commands(
          engine_key, action, workers_affected, cascade, requested_by, status
        ) VALUES($1, $2, $3, $4, $5, 'pending')
        RETURNING id
      `, [typedEngineKey, action, changed, cascade, user.email ?? null])
      const engineCommandId = command.rows[0]?.id
      for (const workerName of changed) {
        await client.query(`
          INSERT INTO worker_commands(
            worker_name, command_type, payload, requested_by, status
          ) VALUES($1, $2, $3::jsonb, $4, 'accepted')
        `, [workerName, action, JSON.stringify({ engineKey: typedEngineKey, engineCommandId, cascade }), user.email ?? null])
      }
      await client.query(
        'INSERT INTO audit_log(actor_id, action, target, after) VALUES($1, $2, $3, $4::jsonb)',
        [user.email ?? 'operator', `engine.${action}`, typedEngineKey, JSON.stringify({ engineCommandId, cascade, changed })],
      )
      await client.query('COMMIT')
      return NextResponse.json({
        ok: true,
        action,
        engineKey: typedEngineKey,
        cascade,
        changed,
        enginesAffected: engineKeys,
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}

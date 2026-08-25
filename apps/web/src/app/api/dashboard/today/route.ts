import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import { AUTOMATION_ENGINES } from '@plataforma/shared'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

export async function GET() {
  try { await requireRole('viewer') } catch (error) { return apiErrorResponse(error) }
  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const registry = createQueueRegistry(process.env.REDIS_URL!)
  try {
    const { selected } = await getCampaignContext(pool)
    const campaignId = selected?.id ?? null
    const [decisions, slots, workers, tokens, queueFailures] = await Promise.all([
      pool.query<{ review: number; radar: number; insights: number; suggestions: number; engagement: number }>(`SELECT
        (SELECT count(*)::int FROM review_inbox WHERE status='pending' OR (status='snoozed' AND COALESCE(context->>'snooze_until','') <= now()::text)) review,
        (SELECT count(*)::int FROM radar_findings WHERE NOT processed AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL)) radar,
        (SELECT count(*)::int FROM competitor_insights WHERE NOT processed AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL)) insights,
        (SELECT count(*)::int FROM content_suggestions WHERE curation_status='proposed' AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL)) suggestions,
        (SELECT count(*)::int FROM engagement_actions WHERE status IN ('pending','awaiting_approval') AND ($1::uuid IS NULL OR campaign_id=$1)) engagement`, [campaignId]),
      pool.query<{ id: string; title: string; channel: string; scheduled_for: string }>(`SELECT id,COALESCE(title,caption,'Publicação') title,channel,scheduled_for::text FROM scheduled_publications WHERE status IN ('approved','scheduled') AND scheduled_for>=now() AND scheduled_for<now()+interval '24 hours' AND ($1::uuid IS NULL OR campaign_id=$1 OR campaign_id IS NULL) ORDER BY scheduled_for`, [campaignId]),
      pool.query<{ worker_name: string; engine_key: string; enabled: boolean; last_error: string | null; last_run_state: string | null; heartbeat_state: string | null; last_beat_at: string | null }>(`SELECT ws.worker_name,ws.engine_key,ws.enabled,ws.last_error,last_run.result_state last_run_state,heartbeat.state heartbeat_state,heartbeat.last_beat_at::text FROM worker_settings ws LEFT JOIN LATERAL (SELECT state,last_beat_at FROM worker_heartbeats WHERE worker=ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true LEFT JOIN LATERAL (SELECT result_state FROM worker_runs WHERE worker_name=ws.worker_name ORDER BY started_at DESC LIMIT 1) last_run ON true ORDER BY ws.worker_name`),
      pool.query<{ id: string; username: string; role: string; expires_at: string }>(`SELECT id,username,role,meta_token_expires_at::text expires_at FROM accounts WHERE meta_token_expires_at IS NOT NULL AND meta_token_expires_at<=now()+interval '7 days' ORDER BY meta_token_expires_at`),
      Promise.all(Object.entries(registry.queues).map(async ([name, queue]) => {
        try { return { name, failed: await queue.getFailedCount() } } catch { return { name, failed: -1 } }
      })),
    ])

    const engineAttention = AUTOMATION_ENGINES.flatMap((engine) => {
      const rows = workers.rows.filter((worker) => worker.engine_key === engine.key)
      const errors = rows.filter((worker) => worker.last_run_state === 'failed').length
      const divergent = rows.filter((worker) => worker.enabled && worker.heartbeat_state !== 'running').length
      if (!errors && !divergent) return []
      return [{ key: engine.key, name: engine.name_pt, state: errors ? 'error' : 'attention', errors, divergent }]
    })
    const failedQueues = queueFailures.filter((queue) => queue.failed !== 0)
    const counts = decisions.rows[0] ?? { review: 0, radar: 0, insights: 0, suggestions: 0, engagement: 0 }
    const actions = [
      counts.review + counts.radar + counts.insights + counts.suggestions > 0 ? { label: 'Revisar decisões pendentes', href: '/decisoes?aba=revisao' } : null,
      counts.engagement > 0 ? { label: 'Revisar fila de engajamento', href: '/decisoes?aba=engajamento' } : null,
      engineAttention.length || failedQueues.length ? { label: 'Ver automações', href: '/automacoes?aba=motores' } : null,
      tokens.rows.length ? { label: 'Renovar integrações', href: '/automacoes?aba=contas' } : null,
      { label: 'Acompanhar funil editorial', href: '/conteudo?aba=funil' },
    ].filter(Boolean)

    return NextResponse.json({
      generatedAt: new Date().toISOString(), campaign: selected ? { id: selected.id, name: selected.name } : null,
      decisions: counts, slots: slots.rows, engines: engineAttention, failedQueues, expiringTokens: tokens.rows, actions,
    })
  } catch (error) {
    return apiErrorResponse(error)
  } finally {
    await Promise.all(Object.values(registry.queues).map((queue) => queue.close()))
    await registry.connection.quit()
  }
}

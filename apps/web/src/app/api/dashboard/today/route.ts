import { createDatabase } from '@plataforma/db'
import { createQueueRegistry } from '@plataforma/queue'
import { AUTOMATION_ENGINES } from '@plataforma/shared'
import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-errors'
import { getCampaignContext } from '@/lib/campaign-context'
import { requireRole } from '@/lib/permissions'

export async function GET() {
  const traceId = crypto.randomUUID()
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
      pool.query<{ worker_name: string; engine_key: string; enabled: boolean; last_run_state: string | null; heartbeat_state: string | null; last_success_at: string | null; incident_id: string | null; reason_code: string | null; title_pt: string | null; impact_pt: string | null; next_action_pt: string | null; trace_id: string | null }>(`SELECT ws.worker_name,ws.engine_key,ws.enabled,last_run.result_state last_run_state,last_success.last_success_at::text,heartbeat.state heartbeat_state,incident.id incident_id,incident.reason_code,incident.title_pt,incident.impact_pt,incident.next_action_pt,incident.trace_id
        FROM worker_settings ws
        LEFT JOIN LATERAL (SELECT state,last_beat_at FROM worker_heartbeats WHERE worker=ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true
        LEFT JOIN LATERAL (SELECT result_state FROM worker_runs WHERE worker_name=ws.worker_name ORDER BY started_at DESC LIMIT 1) last_run ON true
        LEFT JOIN LATERAL (SELECT last_success_at FROM worker_settings WHERE worker_name=ws.worker_name) last_success ON true
        LEFT JOIN LATERAL (SELECT id,reason_code,title_pt,impact_pt,next_action_pt,trace_id FROM automation_incidents WHERE worker_name=ws.worker_name AND resolved_at IS NULL ORDER BY occurred_at DESC LIMIT 1) incident ON true
        ORDER BY ws.worker_name`),
      pool.query<{ id: string; username: string; role: string; expires_at: string }>(`SELECT id,username,role,meta_token_expires_at::text expires_at FROM accounts WHERE meta_token_expires_at IS NOT NULL AND meta_token_expires_at<=now()+interval '7 days' ORDER BY meta_token_expires_at`),
      Promise.all(Object.entries(registry.queues).map(async ([name, queue]) => { try { return { name, failed: await queue.getFailedCount() } } catch { return { name, failed: -1 } } })),
    ])

    const engineAttention = AUTOMATION_ENGINES.flatMap((engine) => {
      const rows = workers.rows.filter((worker) => worker.engine_key === engine.key)
      const incident = rows.find((worker) => worker.enabled && worker.incident_id)
      const divergent = rows.filter((worker) => worker.enabled && worker.heartbeat_state !== 'running').length
      if (!incident && !divergent) return []
      return [{ key: engine.key, name: engine.name_pt, state: incident ? 'error' as const : 'attention' as const, errors: incident ? 1 : 0, divergent, reasonCode: incident?.reason_code ?? null, title: incident?.title_pt ?? null, impact: incident?.impact_pt ?? null, nextAction: incident?.next_action_pt ?? null, traceId: incident?.trace_id ?? null, lastSuccessAt: incident?.last_success_at ?? null }]
    })
    const failedQueues = queueFailures.filter((queue) => queue.failed !== 0)
    const counts = decisions.rows[0] ?? { review: 0, radar: 0, insights: 0, suggestions: 0, engagement: 0 }
    const actions = [
      counts.review + counts.radar + counts.insights + counts.suggestions > 0 ? { label: 'Revisar decisões pendentes', href: '/decisoes' } : null,
      counts.engagement > 0 ? { label: 'Revisar fila de engajamento', href: '/decisoes/engajamento' } : null,
      engineAttention.length || failedQueues.length ? { label: 'Ver prontidão e incidentes', href: '/sistema' } : null,
      tokens.rows.length ? { label: 'Renovar integrações', href: '/sistema/integracoes' } : null,
      { label: 'Acompanhar funil editorial', href: '/planejamento/funil' },
    ].filter(Boolean) as Array<{ label: string; href: string }>

    return NextResponse.json({
      generatedAt: new Date().toISOString(), campaign: selected ? { id: selected.id, name: selected.name } : null,
      decisions: counts, slots: slots.rows, engines: engineAttention, failedQueues, expiringTokens: tokens.rows, actions,
      meta: { traceId, sourceStatus: 'ready' },
    })
  } catch (error) {
    return apiErrorResponse(error)
  } finally {
    await Promise.all(Object.values(registry.queues).map((queue) => queue.close()))
    await registry.connection.quit()
  }
}


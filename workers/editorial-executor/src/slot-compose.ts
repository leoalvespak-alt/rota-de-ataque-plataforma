import type { Pool } from 'pg'
import type { TaskHandler } from '@plataforma/task-runtime'
import type { SlotBrief } from '@plataforma/shared'
import { composeSlotDecision } from '@plataforma/worker-content-item-orchestrator'

interface FindingRow {
  id: string
  title: string
  summary: string | null
  source_url: string | null
  source_name: string | null
  categoria: string
  estado: string | null
  relevance_score: number
  confidence: number
  factuality_score: number
  content: string | null
}

export function createSlotComposeTaskHandler(pool: Pool): TaskHandler {
  return async (request, context) => {
    const payload = request.payload as { findingId?: string; channel?: 'instagram' | 'threads' }
    if (!payload.findingId) throw new Error('slot.compose requires findingId')
    const rows = await pool.query<FindingRow>(
      `SELECT f.id, f.title, f.summary, f.source_url, f.source_name, f.categoria, f.estado,
              f.relevance_score, f.confidence, f.factuality_score, ni.content
       FROM radar_findings f LEFT JOIN news_items ni ON ni.id = f.news_item_id
       WHERE f.id = $1::uuid`,
      [payload.findingId],
    )
    const finding = rows.rows[0]
    if (!finding) throw new Error(`Radar finding ${payload.findingId} was not found`)
    const brief: SlotBrief = {
      findingId: finding.id,
      title: finding.title,
      summary: finding.summary,
      content: finding.content,
      sourceUrl: finding.source_url,
      sourceName: finding.source_name,
      categoria: finding.categoria,
      estado: finding.estado,
      relevanceScore: finding.relevance_score,
      confidence: finding.confidence,
      factualityScore: finding.factuality_score,
      jevPreserved: null,
      channel: payload.channel ?? 'instagram',
    }
    const composed = await composeSlotDecision(brief, { signal: context.signal })
    await pool.query(
      `INSERT INTO editorial.slot_decisions(finding_id,brief,decision,provider,status,error)
       VALUES($1::uuid,$2::jsonb,$3::jsonb,$4,$5,$6)`,
      [
        finding.id,
        JSON.stringify(brief),
        composed.decision ? JSON.stringify(composed.decision) : null,
        composed.provider ?? null,
        composed.ok ? 'composed' : 'failed',
        composed.ok ? null : (composed.error ?? 'unknown'),
      ],
    )
    if (!composed.ok || !composed.decision) throw new Error(`slot.compose failed: ${composed.error ?? 'unknown'}`)
    console.info(JSON.stringify({
      event: 'slot.compose.completed', idempotencyKey: request.idempotencyKey,
      runId: context.runId, attempt: context.attempt,
      priority: composed.decision.priority, reviewMode: composed.decision.reviewMode, postType: composed.decision.postType,
    }))
    return {
      result: { ok: true, findingId: finding.id, decision: composed.decision, provider: composed.provider ?? null },
      events: [{
        eventKey: `${request.idempotencyKey}:slot.compose.completed`,
        eventType: 'slot.compose.completed',
        payload: { runId: context.runId, findingId: finding.id, decision: composed.decision },
      }],
    }
  }
}


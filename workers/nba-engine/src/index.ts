import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'nba-engine', requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)

export type NbaEventType = 'classification.done' | 'reciprocity.detected' | 'lead.priority.changed' | 'dm_inbound' | 'live_interaction' | 'new_follower_detected'
export interface NbaPayload { eventType: NbaEventType; leadId: string; campaignId: string; accountId?: string; targetRef?: Record<string, unknown> }
export interface NbaRule { id: string; name: string; conditionExpr: string; actionExpr: string; priority: number }
export interface NbaContext { rules: NbaRule[]; threshold: number; allowedActions: string[]; hasInboundDm: boolean }
export interface NbaDecision { action: string; rationale: string; confidence: number; enqueue: boolean; requiresReview: boolean }
export interface NbaRepository { context(payload: NbaPayload): Promise<NbaContext>; persist(payload: NbaPayload, decision: NbaDecision, traceId: string): Promise<void> }

const defaultAction: Record<NbaEventType, string> = {
  'classification.done': 'reply_public',
  'reciprocity.detected': 'like_post',
  'lead.priority.changed': 'follow',
  dm_inbound: 'dm',
  live_interaction: 'reply_public',
  new_follower_detected: 'follow',
}

const parseAction = (expression: string) => {
  try {
    const parsed = JSON.parse(expression) as { action?: string; confidence?: number; rationale?: string }
    return parsed.action ? parsed : null
  } catch {
    const action = expression.match(/action\s*[=:]\s*([a-z_]+)/i)?.[1]
    const confidence = Number(expression.match(/confidence\s*[=:]\s*([\d.]+)/i)?.[1] ?? 0.7)
    return action ? { action, confidence, rationale: expression } : null
  }
}

const matches = (expression: string, eventType: NbaEventType) => {
  if (!expression || expression === '*') return true
  try {
    const parsed = JSON.parse(expression) as { eventType?: string | string[] }
    const event = parsed.eventType
    return Array.isArray(event) ? event.includes(eventType) : !event || event === eventType
  } catch {
    return expression.includes(eventType) || expression.includes('*')
  }
}

export function decideNextBestAction(payload: NbaPayload, context: NbaContext): NbaDecision {
  const rule = [...context.rules].sort((a, b) => b.priority - a.priority).find((item) => matches(item.conditionExpr, payload.eventType))
  const parsed = rule ? parseAction(rule.actionExpr) : null
  const action = parsed?.action ?? defaultAction[payload.eventType]
  const confidence = Math.max(0, Math.min(1, parsed?.confidence ?? (rule ? 0.75 : 0.6)))
  const dmAllowed = action !== 'dm' || (payload.eventType === 'dm_inbound' && context.hasInboundDm)
  const allowed = context.allowedActions.includes(action) && dmAllowed
  return {
    action,
    confidence,
    enqueue: allowed && confidence >= context.threshold,
    requiresReview: true,
    rationale: parsed?.rationale ?? (rule ? `Regra ${rule.name} aplicada ao evento ${payload.eventType}` : `Heurística conservadora para ${payload.eventType}`),
  }
}

export function createNbaProcessor(repository: NbaRepository) {
  const gate = createWorker<NbaPayload>(spec)
  return async (job: WorkerJob<NbaPayload>): Promise<WorkerResult> => {
    const base = await gate(job)
    const context = await repository.context(job.payload)
    const decision = decideNextBestAction(job.payload, context)
    await repository.persist(job.payload, decision, base.traceId)
    return { ...base, event: { kind: 'nba.recommendation.created', payload: decision } }
  }
}

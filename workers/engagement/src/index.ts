import { engagementActionsTotal, engagementLatency } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'engagement', requiredRole: 'actor', outbound: true, requiresMetaToken: false } satisfies WorkerSpec
export const processJob = createWorker(spec)
export interface EngagementPayload { actionId: string; synthetic?: boolean }
export interface EngagementAction { id: string; accountId: string; leadId: string; campaignId: string; targetRefId: string; profileUrl: string; actionType: string; reasonCode: string; approvedBy: string | null; status: string }
export interface EngagementPolicy { enabled: boolean; hourlyLimit: number; dailyLimit: number; cooldownSeconds: number; hourCount: number; dayCount: number; lastActionAt: Date | null }
export interface EngagementRepository { action(id: string): Promise<EngagementAction | null>; policy(accountId: string, actionType: string): Promise<EngagementPolicy | null>; hasTrail(leadId: string): Promise<boolean>; running(id: string): Promise<boolean>; complete(action: EngagementAction, changed: boolean, traceId: string): Promise<void>; fail(id: string, error: unknown, traceId: string): Promise<void> }
export interface EngagementExecutor { follow(action: EngagementAction): Promise<{ changed: boolean }> }
export interface EngagementQueue { retention(actionId: string, checkpointDays: number, delayMs: number): Promise<void> }

export function createEngagementProcessor(repository: EngagementRepository, executor: EngagementExecutor, queue?: EngagementQueue) {
  const gate = createWorker<EngagementPayload>(spec)
  return async (job: WorkerJob<EngagementPayload>): Promise<WorkerResult> => {
    const started = Date.now()
    const base = await gate(job)
    const action = await repository.action(job.payload.actionId)
    if (!action || action.status === 'done') return { ...base, event: { kind: 'engagement.skipped', payload: { reason: 'ALREADY_DONE' } } }
    if (action.actionType !== 'follow') throw Object.assign(new Error('Only follow is enabled in conservative rollout'), { reasonCode: 'ACTION_REJECTED' })
    if (!action.approvedBy) throw Object.assign(new Error('Human approval is required'), { reasonCode: 'PREFLIGHT_FAILED' })
    if (!await repository.hasTrail(action.leadId)) throw Object.assign(new Error('Blind prospecting is blocked'), { reasonCode: 'PREFLIGHT_FAILED' })
    const policy = await repository.policy(action.accountId, action.actionType)
    if (!policy?.enabled) throw Object.assign(new Error('Action policy is disabled'), { reasonCode: 'PREFLIGHT_FAILED' })
    const cooldownOpen = !policy.lastActionAt || Date.now() - policy.lastActionAt.getTime() >= policy.cooldownSeconds * 1000
    if (policy.hourCount >= policy.hourlyLimit || policy.dayCount >= policy.dailyLimit || !cooldownOpen) throw Object.assign(new Error('Action policy limit reached'), { reasonCode: 'RATE_LIMITED' })
    if (!await repository.running(action.id)) return { ...base, event: { kind: 'engagement.skipped', payload: { reason: 'ALREADY_DONE' } } }
    try {
      const result = await executor.follow(action)
      await repository.complete(action, result.changed, base.traceId)
      for (const days of [1, 7, 30, 90]) await queue?.retention(action.id, days, days * 86_400_000)
      engagementActionsTotal.inc({ action: 'follow', status: 'done' })
      return { ...base, event: { kind: 'engagement.completed', payload: { actionId: action.id, changed: result.changed } } }
    } catch (error) {
      await repository.fail(action.id, error, base.traceId)
      engagementActionsTotal.inc({ action: 'follow', status: 'failed' })
      throw error
    } finally { engagementLatency.observe(Date.now() - started) }
  }
}

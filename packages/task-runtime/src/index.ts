export type TaskName = 'news-radar.daily' | 'editorial-batch.15day' | 'publication.due' | 'inbox.message' | 'inbox.retention.cleanup' | 'slot.compose'
export type TaskLane = 'default' | 'heavy' | 'publishing' | 'inbound'
export type TaskDestination = 'local'

export interface TaskDefinition {
  name: TaskName
  cadence: 'daily' | 'every-15-days' | 'schedule-time' | 'event'
  destination: TaskDestination
  retryable: boolean
  lane: TaskLane
  priority: number
  maxAttempts: number
}

export const TASK_DEFINITIONS: readonly TaskDefinition[] = [
  { name: 'news-radar.daily', cadence: 'daily', destination: 'local', retryable: true, lane: 'heavy', priority: 30, maxAttempts: 5 },
  { name: 'editorial-batch.15day', cadence: 'every-15-days', destination: 'local', retryable: true, lane: 'heavy', priority: 20, maxAttempts: 4 },
  { name: 'publication.due', cadence: 'schedule-time', destination: 'local', retryable: true, lane: 'publishing', priority: 100, maxAttempts: 5 },
  { name: 'inbox.message', cadence: 'event', destination: 'local', retryable: true, lane: 'inbound', priority: 90, maxAttempts: 5 },
  { name: 'slot.compose', cadence: 'event', destination: 'local', retryable: true, lane: 'heavy', priority: 40, maxAttempts: 3 },
  { name: 'inbox.retention.cleanup', cadence: 'daily', destination: 'local', retryable: true, lane: 'default', priority: 5, maxAttempts: 5 },
] as const

export interface TaskRequest {
  taskName: TaskName
  idempotencyKey: string
  payload: Record<string, unknown>
  scheduleTime?: string
  attempt: number
  accountId?: string
  itemId?: string
  revisionId?: string
  lane: TaskLane
  priority: number
  maxAttempts: number
}

export interface TaskRequestOptions {
  scheduleTime?: string
  occurrenceKey?: string
  attempt?: number
  accountId?: string
  itemId?: string
  revisionId?: string
}

export interface TaskOutboxEvent {
  eventKey: string
  eventType: string
  payload: Record<string, unknown>
}

export interface ClaimedOutboxEvent extends TaskOutboxEvent {
  id: string
  attempt: number
}

export interface TaskExecutionResult {
  result: Record<string, unknown>
  events?: TaskOutboxEvent[]
}

export interface TaskExecutionContext {
  runId: string
  attempt: number
  checkpoint: Record<string, unknown> | null
  signal: AbortSignal
  saveCheckpoint(checkpoint: Record<string, unknown>): Promise<void>
}

export type TaskHandler = (request: TaskRequest, context: TaskExecutionContext) => Promise<TaskExecutionResult>

export interface TaskRunStore {
  acquireLeadership(): Promise<boolean>
  releaseLeadership(): Promise<void>
  isGloballyPaused(): Promise<boolean>
  enqueue(request: TaskRequest): Promise<{ accepted: boolean; runId: string }>
  claimNext(lanes: readonly TaskLane[], owner: string, leaseMs: number, taskNames?: readonly TaskName[]): Promise<ClaimedTask | null>
  heartbeat(runId: string, owner: string, leaseMs: number): Promise<boolean>
  checkpoint(runId: string, owner: string, checkpoint: Record<string, unknown>): Promise<void>
  complete(runId: string, owner: string, execution: TaskExecutionResult): Promise<void>
  fail(runId: string, owner: string, error: string, retryAt: string): Promise<void>
  recoverExpiredLeases(): Promise<number>
  materializeDueSchedules(now?: Date, limit?: number): Promise<number>
  retryFailed(runId: string): Promise<boolean>
  heartbeatExecutor(owner: string, snapshot: ExecutorSnapshot): Promise<void>
  claimOutbox(owner: string, leaseMs: number, eventTypes?: readonly string[]): Promise<ClaimedOutboxEvent | null>
  deliverOutbox(id: string, owner: string): Promise<void>
  failOutbox(id: string, owner: string, error: string, retryAt: string): Promise<void>
  close?(): Promise<void>
}

export interface ClaimedTask extends TaskRequest {
  id: string
  checkpoint: Record<string, unknown> | null
}

export interface ExecutorSnapshot {
  jobsDone: number
  jobsFailed: number
  backlog: number
  state: 'running' | 'paused' | 'stopping' | 'stopped'
}

export function taskDefinition(taskName: TaskName): TaskDefinition {
  const definition = TASK_DEFINITIONS.find(item => item.name === taskName)
  if (!definition) throw new Error(`Unknown task: ${taskName}`)
  return definition
}

export function makeTaskRequest(taskName: TaskName, payload: Record<string, unknown>, options: TaskRequestOptions = {}): TaskRequest {
  const definition = taskDefinition(taskName)
  if (definition.cadence === 'schedule-time' && !options.scheduleTime) throw new Error('scheduleTime is required for publication.due')
  const hasAnyScope = Boolean(options.accountId || options.itemId || options.revisionId)
  if (hasAnyScope && !(options.accountId && options.itemId && options.revisionId)) {
    throw new Error('accountId, itemId and revisionId must be provided together for scoped idempotency')
  }
  if (taskName === 'publication.due' && !hasAnyScope) {
    throw new Error('publication.due requires accountId, itemId and revisionId to prevent schedule collisions')
  }
  const scopedKey = hasAnyScope
    ? `account:${options.accountId}:item:${options.itemId}:revision:${options.revisionId}`
    : options.scheduleTime ?? options.occurrenceKey ?? payload.date ?? payload.batchId ?? payload.eventId
  if (typeof scopedKey !== 'string' || scopedKey.trim() === '') throw new Error('A stable occurrence key or complete item/revision/account scope is required')
  return {
    taskName,
    idempotencyKey: `${taskName}:${scopedKey}`,
    payload,
    scheduleTime: options.scheduleTime,
    attempt: options.attempt ?? 0,
    accountId: options.accountId,
    itemId: options.itemId,
    revisionId: options.revisionId,
    lane: definition.lane,
    priority: definition.priority,
    maxAttempts: definition.maxAttempts,
  }
}

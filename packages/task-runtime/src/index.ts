export type TaskName = 'news-radar.daily' | 'editorial-batch.15day' | 'publication.due'
export type TaskDestination = 'cloud-scheduler' | 'cloud-run' | 'cloud-tasks' | 'local'

export interface TaskDefinition {
  name: TaskName
  cadence: 'daily' | 'every-15-days' | 'schedule-time'
  destination: Exclude<TaskDestination, 'local'>
  retryable: boolean
  resident: false
}

export const TASK_DEFINITIONS: readonly TaskDefinition[] = [
  { name: 'news-radar.daily', cadence: 'daily', destination: 'cloud-run', retryable: true, resident: false },
  { name: 'editorial-batch.15day', cadence: 'every-15-days', destination: 'cloud-run', retryable: true, resident: false },
  { name: 'publication.due', cadence: 'schedule-time', destination: 'cloud-tasks', retryable: true, resident: false },
] as const

export interface TaskRequest {
  taskName: TaskName
  idempotencyKey: string
  payload: Record<string, unknown>
  scheduleTime?: string
  attempt: number
}

export interface TaskRunStore {
  start(request: TaskRequest): Promise<{ accepted: boolean; runId: string }>
  complete(runId: string, result: Record<string, unknown>): Promise<void>
  fail(runId: string, error: string, retryAt?: string): Promise<void>
}

export function taskDefinition(taskName: TaskName): TaskDefinition {
  const definition = TASK_DEFINITIONS.find(item => item.name === taskName)
  if (!definition) throw new Error(`Unknown task: ${taskName}`)
  return definition
}

export function makeTaskRequest(taskName: TaskName, payload: Record<string, unknown>, options: { scheduleTime?: string; attempt?: number } = {}): TaskRequest {
  const definition = taskDefinition(taskName)
  if (definition.cadence === 'schedule-time' && !options.scheduleTime) throw new Error('scheduleTime is required for publication.due')
  const idempotencyKey = `${taskName}:${options.scheduleTime ?? payload.date ?? payload.batchId ?? 'now'}`
  return { taskName, idempotencyKey, payload, scheduleTime: options.scheduleTime, attempt: options.attempt ?? 0 }
}

export function cloudSchedulerPayload(request: TaskRequest): { target: 'cloud-run'; taskName: TaskName; body: string; scheduleTime?: string; retry: boolean } {
  const definition = taskDefinition(request.taskName)
  if (definition.destination !== 'cloud-run') throw new Error(`${request.taskName} is not a Cloud Run task`)
  return { target: 'cloud-run', taskName: request.taskName, body: JSON.stringify(request), scheduleTime: request.scheduleTime, retry: definition.retryable }
}

export function cloudTaskPayload(request: TaskRequest): { target: 'cloud-tasks'; taskName: TaskName; body: string; scheduleTime: string; maxAttempts: number } {
  const definition = taskDefinition(request.taskName)
  if (definition.destination !== 'cloud-tasks' || !request.scheduleTime) throw new Error(`${request.taskName} is not a scheduled Cloud Task`)
  return { target: 'cloud-tasks', taskName: request.taskName, body: JSON.stringify(request), scheduleTime: request.scheduleTime, maxAttempts: 3 }
}

export async function runLocalOnce(request: TaskRequest, store: TaskRunStore, handler: (request: TaskRequest) => Promise<Record<string, unknown>>): Promise<{ accepted: boolean; runId: string; result?: Record<string, unknown> }> {
  const started = await store.start(request)
  if (!started.accepted) return started
  try {
    const result = await handler(request)
    await store.complete(started.runId, result)
    return { ...started, result }
  } catch (error) {
    await store.fail(started.runId, error instanceof Error ? error.message : String(error))
    throw error
  }
}

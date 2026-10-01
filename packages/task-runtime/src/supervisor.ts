import { TASK_DEFINITIONS, type ClaimedTask, type ExecutorSnapshot, type TaskExecutionContext, type TaskHandler, type TaskLane, type TaskName, type TaskRunStore } from './index.js'

export const LANE_LIMITS: Readonly<Record<TaskLane, number>> = {
  default: 2,
  heavy: 1,
  publishing: 1,
  inbound: 2,
}

export type OutboxHandler = (event: { eventKey: string; eventType: string; payload: Record<string, unknown> }) => Promise<void>

export interface SupervisorOptions {
  owner?: string
  handlers: Partial<Record<TaskName, TaskHandler>>
  outboxHandlers?: Record<string, OutboxHandler>
  pollIntervalMs?: number
  heartbeatIntervalMs?: number
  leaseMs?: number
  shutdownGraceMs?: number
  onError?: (error: unknown) => void
}

export class EditorialTaskSupervisor {
  readonly owner: string
  private readonly store: TaskRunStore
  private readonly handlers: Partial<Record<TaskName, TaskHandler>>
  private readonly outboxHandlers: Record<string, OutboxHandler>
  private readonly pollIntervalMs: number
  private readonly heartbeatIntervalMs: number
  private readonly leaseMs: number
  private readonly shutdownGraceMs: number
  private readonly onError: (error: unknown) => void
  private readonly active = new Map<string, { lane: TaskLane; controller: AbortController; promise: Promise<void> }>()
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking: Promise<void> | null = null
  private running = false
  private stopping = false
  private done = 0
  private failed = 0
  private lastHeartbeatAt = 0

  constructor(store: TaskRunStore, options: SupervisorOptions) {
    this.store = store
    this.handlers = options.handlers
    this.outboxHandlers = options.outboxHandlers ?? {}
    this.owner = options.owner ?? `editorial-executor:${crypto.randomUUID()}`
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000
    this.leaseMs = options.leaseMs ?? 60_000
    this.shutdownGraceMs = options.shutdownGraceMs ?? 30_000
    this.onError = options.onError ?? ((error) => console.error('editorial executor error', error))
  }

  async start(): Promise<void> {
    if (this.running) return
    const acquired = await this.store.acquireLeadership()
    if (!acquired) throw new Error('Another editorial executor holds the PostgreSQL leadership lock')
    this.running = true
    try {
      await this.store.recoverExpiredLeases()
      await this.tick()
      if (this.running) this.timer = setInterval(() => void this.tick().catch(this.onError), this.pollIntervalMs)
    } catch (error) {
      this.running = false
      await this.store.releaseLeadership()
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.running && !this.stopping) return
    this.stopping = true
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.ticking?.catch(this.onError)
    await this.writeHeartbeat('stopping').catch(this.onError)
    const inFlight = [...this.active.values()].map(item => item.promise)
    let timeout: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      Promise.allSettled(inFlight),
      new Promise<void>(resolve => { timeout = setTimeout(resolve, this.shutdownGraceMs) }),
    ])
    if (timeout) clearTimeout(timeout)
    if (this.active.size) {
      for (const task of this.active.values()) task.controller.abort(new Error('Executor shutdown grace period elapsed'))
      await Promise.allSettled([...this.active.values()].map(item => item.promise))
    }
    await this.writeHeartbeat('stopped').catch(this.onError)
    await this.store.releaseLeadership()
    this.stopping = false
  }

  snapshot(state: ExecutorSnapshot['state'] = this.stopping ? 'stopping' : 'running'): ExecutorSnapshot {
    return {
      jobsDone: this.done,
      jobsFailed: this.failed,
      backlog: this.active.size,
      state,
    }
  }

  private async writeHeartbeat(state: ExecutorSnapshot['state']) {
    await this.store.heartbeatExecutor(this.owner, this.snapshot(state))
    this.lastHeartbeatAt = Date.now()
  }

  private async tick(): Promise<void> {
    if (!this.running || this.ticking) return this.ticking ?? Promise.resolve()
    this.ticking = this.runTick().finally(() => { this.ticking = null })
    return this.ticking
  }

  private async runTick(): Promise<void> {
    const paused = await this.store.isGloballyPaused()
    if (!paused) {
      await this.store.materializeDueSchedules(new Date(), 20)
      await this.store.recoverExpiredLeases()
      await this.dispatchOutbox()
      for (const lane of Object.keys(LANE_LIMITS) as TaskLane[]) await this.fillLane(lane)
    }
    if (Date.now() - this.lastHeartbeatAt >= this.heartbeatIntervalMs) {
      await this.writeHeartbeat(paused ? 'paused' : 'running')
    }
  }

  private async fillLane(lane: TaskLane): Promise<void> {
    const lanesActive = [...this.active.values()].filter(task => task.lane === lane).length
    const definitions = TASK_DEFINITIONS.filter(definition => definition.lane === lane && this.handlers[definition.name])
    const names = definitions.map(definition => definition.name)
    for (let slot = lanesActive; slot < LANE_LIMITS[lane] && this.running; slot += 1) {
      const task = await this.store.claimNext([lane], this.owner, this.leaseMs, names)
      if (!task) break
      const handler = this.handlers[task.taskName]
      if (!handler) {
        await this.store.fail(task.id, this.owner, `No local handler is registered for ${task.taskName}`, new Date(Date.now() + 60_000).toISOString())
        this.failed += 1
        continue
      }
      const controller = new AbortController()
      const promise = this.execute(task, handler, controller)
      this.active.set(task.id, { lane, controller, promise })
      void promise.finally(() => this.active.delete(task.id)).catch(this.onError)
    }
  }

  private async execute(task: ClaimedTask, handler: TaskHandler, controller: AbortController): Promise<void> {
    const leasePulse = setInterval(() => {
      void this.store.heartbeat(task.id, this.owner, this.leaseMs).then(owned => {
        if (!owned) controller.abort(new Error('Task execution lease was lost'))
      }).catch(error => { this.onError(error); controller.abort(error) })
    }, Math.max(1_000, Math.floor(this.leaseMs / 3)))
    const context: TaskExecutionContext = {
      runId: task.id,
      attempt: task.attempt,
      checkpoint: task.checkpoint,
      signal: controller.signal,
      saveCheckpoint: checkpoint => this.store.checkpoint(task.id, this.owner, checkpoint),
    }
    try {
      const execution = await handler(task, context)
      if (controller.signal.aborted) throw controller.signal.reason ?? new Error('Task aborted')
      await this.store.complete(task.id, this.owner, execution)
      this.done += 1
    } catch (error) {
      this.failed += 1
      const retrySeconds = Math.min(300, 2 ** Math.min(task.attempt, 8))
      const retryAt = new Date(Date.now() + retrySeconds * 1_000).toISOString()
      try { await this.store.fail(task.id, this.owner, error instanceof Error ? error.message : String(error), retryAt) }
      catch (persistError) { this.onError(persistError) }
      this.onError(error)
    } finally {
      clearInterval(leasePulse)
    }
  }

  private async dispatchOutbox(): Promise<void> {
    const eventTypes = Object.keys(this.outboxHandlers)
    if (!eventTypes.length) return
    const event = await this.store.claimOutbox(this.owner, this.leaseMs, eventTypes)
    if (!event) return
    try {
      await this.outboxHandlers[event.eventType]?.(event)
      await this.store.deliverOutbox(event.id, this.owner)
    } catch (error) {
      const retryAt = new Date(Date.now() + Math.min(300, 2 ** Math.min(event.attempt, 8)) * 1_000).toISOString()
      await this.store.failOutbox(event.id, this.owner, error instanceof Error ? error.message : String(error), retryAt)
      this.onError(error)
    }
  }
}

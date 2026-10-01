import { TASK_DEFINITIONS, type ClaimedOutboxEvent, type ClaimedTask, type ExecutorSnapshot, type TaskExecutionResult, type TaskLane, type TaskName, type TaskRequest, type TaskRunStore } from './index.js'
import { nextScheduleAt, type ScheduleCadence } from './scheduling.js'

type QueryResult<Row> = { rows: Row[]; rowCount: number | null }
export interface TaskSqlConnection {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
  release(): void
}
export interface TaskSqlPool {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
  connect(): Promise<TaskSqlConnection>
}

interface ClaimedTaskRow {
  id: string
  taskName: TaskName
  idempotencyKey: string
  payload: Record<string, unknown>
  scheduleTime: Date | null
  attempt: number
  accountId: string | null
  itemId: string | null
  revisionId: string | null
  lane: TaskLane
  priority: number
  maxAttempts: number
  checkpoint: Record<string, unknown> | null
}

interface DueScheduleRow {
  task_name: string
  cadence: ScheduleCadence
  next_run_at: Date
  lane: TaskLane
  priority: number
  configuration: Record<string, unknown>
}

const TASK_NAME_SET = new Set<string>(TASK_DEFINITIONS.map(definition => definition.name))

export class PostgresTaskRunStore implements TaskRunStore {
  private leaderClient: TaskSqlConnection | null = null

  constructor(private readonly pool: TaskSqlPool) {}

  async acquireLeadership(): Promise<boolean> {
    if (this.leaderClient) return true
    const client = await this.pool.connect()
    try {
      const result = await client.query<{ acquired: boolean }>(`SELECT pg_try_advisory_lock(68719476749::bigint) AS acquired`)
      if (result.rows[0]?.acquired !== true) {
        client.release()
        return false
      }
      this.leaderClient = client
      return true
    } catch (error) {
      client.release()
      throw error
    }
  }

  async releaseLeadership(): Promise<void> {
    const client = this.leaderClient
    this.leaderClient = null
    if (!client) return
    try { await client.query(`SELECT pg_advisory_unlock(68719476749::bigint)`) }
    finally { client.release() }
  }

  async isGloballyPaused(): Promise<boolean> {
    const result = await this.pool.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.runtime_controls WHERE control_key='kill-switch:global'`,
    )
    return result.rows[0]?.enabled === true
  }

  private async markUsed(queryable: Pick<TaskSqlPool, 'query'> | Pick<TaskSqlConnection, 'query'>) {
    await queryable.query(`UPDATE editorial.task_runtime_meta SET used_at = COALESCE(used_at, now()) WHERE key='editorial-executor'`)
  }

  async enqueue(request: TaskRequest): Promise<{ accepted: boolean; runId: string }> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await this.markUsed(client)
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO editorial.task_runs
          (task_name,idempotency_key,payload,status,attempt,schedule_time,retry_at,available_at,priority,lane,max_attempts,account_id,item_id,revision_id,updated_at)
         VALUES($1,$2,$3::jsonb,'accepted',$4,$5::timestamptz,NULL,COALESCE($5::timestamptz,now()),$6,$7,$8,$9::uuid,$10::uuid,$11::uuid,now())
         ON CONFLICT DO NOTHING RETURNING id`,
        [request.taskName, request.idempotencyKey, JSON.stringify(request.payload), request.attempt, request.scheduleTime ?? null, request.priority, request.lane, request.maxAttempts, request.accountId ?? null, request.itemId ?? null, request.revisionId ?? null],
      )
      if (inserted.rows[0]) {
        await client.query('COMMIT')
        return { accepted: true, runId: inserted.rows[0].id }
      }
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM editorial.task_runs
         WHERE idempotency_key=$1 OR ($2::uuid IS NOT NULL AND task_name=$3 AND account_id=$2::uuid AND item_id=$4::uuid AND revision_id=$5::uuid)
         ORDER BY created_at LIMIT 1`,
        [request.idempotencyKey, request.accountId ?? null, request.taskName, request.itemId ?? null, request.revisionId ?? null],
      )
      if (!existing.rows[0]) throw new Error('Task enqueue conflict did not resolve to an existing run')
      await client.query('COMMIT')
      return { accepted: false, runId: existing.rows[0].id }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async claimNext(lanes: readonly TaskLane[], owner: string, leaseMs: number, taskNames?: readonly TaskName[]): Promise<ClaimedTask | null> {
    if (lanes.length === 0) return null
    const result = await this.pool.query<ClaimedTaskRow>(
      `WITH global_control AS (
         SELECT enabled FROM public.runtime_controls WHERE control_key='kill-switch:global'
       ), candidate AS (
         SELECT run.id FROM editorial.task_runs run
         WHERE run.status IN ('accepted','retry_scheduled')
           AND run.available_at <= now()
           AND run.lane = ANY($1::text[])
           AND ($2::text[] IS NULL OR run.task_name = ANY($2::text[]))
           AND run.attempt < run.max_attempts
           AND COALESCE((SELECT enabled FROM global_control), false) = false
         ORDER BY run.priority DESC, run.available_at ASC, run.created_at ASC, run.id ASC
         FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE editorial.task_runs run
       SET status='running', attempt=run.attempt+1, started_at=COALESCE(run.started_at,now()),
       lease_owner=$3, lease_until=now()+($4::int * interval '1 millisecond'), heartbeat_at=now(), updated_at=now()
       FROM candidate WHERE run.id=candidate.id
       RETURNING run.id, run.task_name AS "taskName", run.idempotency_key AS "idempotencyKey", run.payload,
         run.schedule_time AS "scheduleTime", run.attempt, run.account_id AS "accountId", run.item_id AS "itemId",
         run.revision_id AS "revisionId", run.lane, run.priority, run.max_attempts AS "maxAttempts", run.checkpoint`,
      [[...lanes], taskNames ? [...taskNames] : null, owner, Math.max(3_000, leaseMs)],
    )
    const row = result.rows[0]
    if (!row) return null
    await this.markUsed(this.pool)
    return {
      id: row.id,
      taskName: row.taskName,
      idempotencyKey: row.idempotencyKey,
      payload: row.payload,
      scheduleTime: row.scheduleTime?.toISOString(),
      attempt: row.attempt,
      accountId: row.accountId ?? undefined,
      itemId: row.itemId ?? undefined,
      revisionId: row.revisionId ?? undefined,
      lane: row.lane,
      priority: row.priority,
      maxAttempts: row.maxAttempts,
      checkpoint: row.checkpoint,
    }
  }

  async heartbeat(runId: string, owner: string, leaseMs: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE editorial.task_runs SET heartbeat_at=now(), lease_until=now()+($3::int * interval '1 millisecond'), updated_at=now()
       WHERE id=$1::uuid AND status='running' AND lease_owner=$2`,
      [runId, owner, Math.max(3_000, leaseMs)],
    )
    return (result.rowCount ?? 0) === 1
  }

  async checkpoint(runId: string, owner: string, checkpoint: Record<string, unknown>): Promise<void> {
    const result = await this.pool.query(
      `UPDATE editorial.task_runs SET checkpoint=$3::jsonb, heartbeat_at=now(), updated_at=now()
       WHERE id=$1::uuid AND status='running' AND lease_owner=$2`,
      [runId, owner, JSON.stringify(checkpoint)],
    )
    if ((result.rowCount ?? 0) !== 1) throw new Error(`Task ${runId} no longer holds its execution lease`)
  }

  async complete(runId: string, owner: string, execution: TaskExecutionResult): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const updated = await client.query<{ id: string }>(
        `UPDATE editorial.task_runs SET status='completed', result=$3::jsonb, error=NULL, completed_at=now(),
          lease_owner=NULL, lease_until=NULL, heartbeat_at=now(), updated_at=now()
         WHERE id=$1::uuid AND status='running' AND lease_owner=$2 RETURNING id`,
        [runId, owner, JSON.stringify(execution.result)],
      )
      if (!updated.rows[0]) throw new Error(`Task ${runId} no longer holds its execution lease`)
      for (const event of execution.events ?? []) {
        await client.query(
          `INSERT INTO editorial.task_outbox(run_id,event_key,event_type,payload)
           VALUES($1::uuid,$2,$3,$4::jsonb) ON CONFLICT(event_key) DO NOTHING`,
          [runId, event.eventKey, event.eventType, JSON.stringify(event.payload)],
        )
      }
      await this.markUsed(client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async fail(runId: string, owner: string, error: string, retryAt: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const updated = await client.query<{ id: string; status: string; attempt: number }>(
        `UPDATE editorial.task_runs SET
           status=CASE WHEN attempt < max_attempts THEN 'retry_scheduled' ELSE 'failed' END,
           error=$3,
           retry_at=CASE WHEN attempt < max_attempts THEN $4::timestamptz ELSE NULL END,
           available_at=CASE WHEN attempt < max_attempts THEN $4::timestamptz ELSE now() END,
           completed_at=CASE WHEN attempt < max_attempts THEN NULL ELSE now() END,
           lease_owner=NULL, lease_until=NULL, heartbeat_at=now(), updated_at=now()
         WHERE id=$1::uuid AND status='running' AND lease_owner=$2
         RETURNING id,status,attempt`,
        [runId, owner, error.slice(0, 4_000), retryAt],
      )
      const row = updated.rows[0]
      if (!row) throw new Error(`Task ${runId} no longer holds its execution lease`)
      if (row.status === 'failed') {
        await client.query(
          `INSERT INTO editorial.task_outbox(run_id,event_key,event_type,payload)
           VALUES($1::uuid,$2,'task.failed',$3::jsonb) ON CONFLICT(event_key) DO NOTHING`,
          [runId, `${runId}:attempt:${row.attempt}:failed`, JSON.stringify({ runId, attempt: row.attempt, error: error.slice(0, 1_000) })],
        )
      }
      await this.markUsed(client)
      await client.query('COMMIT')
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw cause
    } finally {
      client.release()
    }
  }

  async recoverExpiredLeases(): Promise<number> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const expired = await client.query<{ id: string; status: string; attempt: number; error: string | null }>(
        `UPDATE editorial.task_runs SET
           status=CASE WHEN attempt < max_attempts THEN 'retry_scheduled' ELSE 'failed' END,
           error=COALESCE(error,'Executor lease expired before task completion'),
           retry_at=CASE WHEN attempt < max_attempts THEN now() ELSE NULL END,
           available_at=now(), completed_at=CASE WHEN attempt < max_attempts THEN NULL ELSE now() END,
           lease_owner=NULL,lease_until=NULL,updated_at=now()
         WHERE status='running' AND lease_until < now()
         RETURNING id,status,attempt,error`,
      )
      for (const row of expired.rows.filter(item => item.status === 'failed')) {
        await client.query(
          `INSERT INTO editorial.task_outbox(run_id,event_key,event_type,payload)
           VALUES($1::uuid,$2,'task.failed',$3::jsonb) ON CONFLICT(event_key) DO NOTHING`,
          [row.id, `${row.id}:attempt:${row.attempt}:lease-expired`, JSON.stringify({ runId: row.id, attempt: row.attempt, error: row.error })],
        )
      }
      if (expired.rows.length) await this.markUsed(client)
      await client.query('COMMIT')
      return expired.rows.length
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async materializeDueSchedules(now = new Date(), limit = 20): Promise<number> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const due = await client.query<DueScheduleRow>(
        `SELECT task_name,cadence,next_run_at,lane,priority,configuration FROM editorial.task_schedules
         WHERE enabled=true AND destination='local' AND cadence IN ('daily','every-15-days','twice-daily') AND next_run_at <= $1::timestamptz
         ORDER BY next_run_at,task_name FOR UPDATE SKIP LOCKED LIMIT $2`,
        [now.toISOString(), limit],
      )
      for (const schedule of due.rows) {
        if (!TASK_NAME_SET.has(schedule.task_name)) throw new Error(`No task definition exists for schedule ${schedule.task_name}`)
        const taskName = schedule.task_name as TaskName
        const scheduledAt = new Date(schedule.next_run_at)
        const payload = { ...schedule.configuration, scheduledAt: scheduledAt.toISOString() }
        const idempotencyKey = `schedule:${taskName}:${scheduledAt.toISOString()}`
        await client.query(
          `INSERT INTO editorial.task_runs(task_name,idempotency_key,payload,status,attempt,schedule_time,available_at,priority,lane,max_attempts,updated_at)
           VALUES($1,$2,$3::jsonb,'accepted',0,$4::timestamptz,$5::timestamptz,$6,$7,$8,now()) ON CONFLICT DO NOTHING`,
          [taskName, idempotencyKey, JSON.stringify(payload), scheduledAt.toISOString(), now.toISOString(), schedule.priority, schedule.lane, TASK_DEFINITIONS.find(item => item.name === taskName)?.maxAttempts ?? 5],
        )
        const nextAt = nextScheduleAt(schedule.cadence, scheduledAt, now, schedule.configuration)
        await client.query(
          `UPDATE editorial.task_schedules SET last_run_at=$2::timestamptz,next_run_at=$3::timestamptz,updated_at=now() WHERE task_name=$1`,
          [taskName, scheduledAt.toISOString(), nextAt.toISOString()],
        )
      }
      if (due.rows.length) await this.markUsed(client)
      await client.query('COMMIT')
      return due.rows.length
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async retryFailed(runId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE editorial.task_runs SET status='accepted',available_at=now(),retry_at=NULL,completed_at=NULL,error=NULL,
         max_attempts=GREATEST(max_attempts,attempt+1),lease_owner=NULL,lease_until=NULL,updated_at=now()
       WHERE id=$1::uuid AND status='failed'`,
      [runId],
    )
    if ((result.rowCount ?? 0) > 0) await this.markUsed(this.pool)
    return (result.rowCount ?? 0) === 1
  }

  async claimOutbox(owner: string, leaseMs: number, eventTypes?: readonly string[]): Promise<ClaimedOutboxEvent | null> {
    if (eventTypes?.length === 0) return null
    const result = await this.pool.query<{ id: string; eventKey: string; eventType: string; payload: Record<string, unknown>; attempts: number }>(
      `WITH candidate AS (
         SELECT id FROM editorial.task_outbox
         WHERE status IN ('pending','failed','delivering')
           AND available_at <= now()
           AND (status <> 'delivering' OR lease_until < now())
           AND attempts < 5
           AND ($1::text[] IS NULL OR event_type = ANY($1::text[]))
         ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE editorial.task_outbox event SET status='delivering',attempts=event.attempts+1,
         lease_owner=$2,lease_until=now()+($3::int * interval '1 millisecond')
       FROM candidate WHERE event.id=candidate.id
       RETURNING event.id,event.event_key AS "eventKey",event.event_type AS "eventType",event.payload,event.attempts`,
      [eventTypes ? [...eventTypes] : null, owner, Math.max(3_000, leaseMs)],
    )
    const row = result.rows[0]
    if (!row) return null
    await this.markUsed(this.pool)
    return { id: row.id, eventKey: row.eventKey, eventType: row.eventType, payload: row.payload, attempt: row.attempts }
  }

  async deliverOutbox(id: string, owner: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE editorial.task_outbox SET status='delivered',delivered_at=now(),lease_owner=NULL,lease_until=NULL,last_error=NULL
       WHERE id=$1::uuid AND status='delivering' AND lease_owner=$2`,
      [id, owner],
    )
    if ((result.rowCount ?? 0) !== 1) throw new Error(`Outbox event ${id} no longer holds its delivery lease`)
  }

  async failOutbox(id: string, owner: string, error: string, retryAt: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE editorial.task_outbox SET
         status='failed',
         available_at=CASE WHEN attempts < 5 THEN $3::timestamptz ELSE 'infinity'::timestamptz END,
         last_error=$4,lease_owner=NULL,lease_until=NULL
       WHERE id=$1::uuid AND status='delivering' AND lease_owner=$2`,
      [id, owner, retryAt, error.slice(0, 4_000)],
    )
    if ((result.rowCount ?? 0) !== 1) throw new Error(`Outbox event ${id} no longer holds its delivery lease`)
  }

  async heartbeatExecutor(owner: string, snapshot: ExecutorSnapshot): Promise<void> {
    const result = await this.pool.query<{ backlog: number }>(
      `SELECT count(*)::int AS backlog FROM editorial.task_runs WHERE status IN ('accepted','retry_scheduled')`,
    )
    await this.pool.query(
      `INSERT INTO public.worker_heartbeats(worker,instance_id,last_beat_at,jobs_done_window,jobs_failed_window,backlog_seen,p95_latency_ms,state)
       VALUES('editorial-executor',$1,now(),$2,$3,$4,NULL,$5)
       ON CONFLICT(worker,instance_id) DO UPDATE SET last_beat_at=now(),jobs_done_window=EXCLUDED.jobs_done_window,
         jobs_failed_window=EXCLUDED.jobs_failed_window,backlog_seen=EXCLUDED.backlog_seen,state=EXCLUDED.state`,
      [owner, snapshot.jobsDone, snapshot.jobsFailed, Number(result.rows[0]?.backlog ?? 0), snapshot.state],
    )
  }
}

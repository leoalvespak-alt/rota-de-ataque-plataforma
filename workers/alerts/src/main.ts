import { createDatabase } from '@plataforma/db'
import { ResendEmailChannel, TelegramChannel, fingerprint, type NotificationChannel } from '@plataforma/notifications'
import { createQueueRegistry, installPlatformSchedulers } from '@plataforma/queue'
import { runWorker } from '@plataforma/queue/runtime'
import type { ErrorEvent, QueueName } from '@plataforma/shared'
import { QueueEvents } from 'bullmq'
import { createAlertProcessor, spec, type AlertRepository } from './index.js'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required')

const { pool } = createDatabase(databaseUrl)
const registry = createQueueRegistry(redisUrl)
const severityRank = { info: 0, warn: 1, error: 2, critical: 3 } as const
type Severity = keyof typeof severityRank

const configuredChannels = (): Record<string, NotificationChannel | undefined> => ({
  email: process.env.RESEND_API_KEY && (process.env.ALERT_EMAIL_FROM ?? process.env.RESEND_FROM) && (process.env.ALERT_EMAIL_TO ?? process.env.ALERTS_EMAIL_TO)
    ? new ResendEmailChannel(
      process.env.RESEND_API_KEY,
      process.env.ALERT_EMAIL_FROM ?? process.env.RESEND_FROM ?? '',
      (process.env.ALERT_EMAIL_TO ?? process.env.ALERTS_EMAIL_TO ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    )
    : undefined,
  telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
    ? new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID)
    : undefined,
})

const normalizeChannels = (value: unknown, severity: Severity) => {
  if (Array.isArray(value)) return value.map(String)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const selected = record[severity]
    if (Array.isArray(selected)) return selected.map(String)
  }
  return severity === 'critical' ? ['telegram', 'email'] : severity === 'error' ? ['email'] : []
}

async function routeEvent(event: ErrorEvent, routeTraceId: string) {
  const serialized = JSON.stringify(event)
  const trigger = (await pool.query<{
    id: string
    severity: Severity | null
    channels: unknown
    throttle_seconds: number | null
    escalation_policy: unknown
  }>(
    `SELECT id, severity, channels, throttle_seconds, escalation_policy
     FROM error_triggers
     WHERE active = true
       AND (match_expr IS NULL OR match_expr = '' OR $1 ILIKE '%' || match_expr || '%')
     ORDER BY last_hit_at DESC NULLS LAST, name
     LIMIT 1`,
    [serialized],
  )).rows[0]

  let severity: Severity = trigger?.severity ?? event.severity
  const eventFingerprint = fingerprint(event.source, event.metric ?? event.worker, `${event.reason_code}:${event.error}`)
  const existing = (await pool.query<{ id: string; payload: Record<string, unknown>; severity: Severity; created_at: Date }>(
    `SELECT id, payload, severity, created_at
     FROM alerts WHERE fingerprint = $1 AND resolved_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [eventFingerprint],
  )).rows[0]
  const occurrences = Number(existing?.payload?.occurrences ?? 0) + 1
  const escalation = trigger?.escalation_policy && typeof trigger.escalation_policy === 'object'
    ? trigger.escalation_policy as Record<string, unknown>
    : {}
  const escalateAfter = Number(escalation.occurrences ?? 0)
  if (escalateAfter > 0 && occurrences >= escalateAfter && severityRank[severity] < severityRank.critical) severity = 'critical'

  const alert = existing
    ? (await pool.query<{ id: string }>(
      `UPDATE alerts
       SET severity = $2,
           payload = payload || $3::jsonb
       WHERE id = $1 RETURNING id`,
      [existing.id, severity, JSON.stringify({ ...event, occurrences, route_trace_id: routeTraceId, last_seen_at: new Date().toISOString() })],
    )).rows[0]!
    : (await pool.query<{ id: string }>(
      `INSERT INTO alerts(kind, severity, payload, fingerprint)
       VALUES($1, $2, $3::jsonb, $4) RETURNING id`,
      [event.metric ?? event.reason_code, severity, JSON.stringify({ ...event, occurrences, route_trace_id: routeTraceId }), eventFingerprint],
    )).rows[0]!

  if (trigger) {
    await pool.query('UPDATE error_triggers SET hit_count = hit_count + 1, last_hit_at = now() WHERE id = $1', [trigger.id])
  }

  const throttleSeconds = trigger?.throttle_seconds ?? 300
  const recentlyDelivered = Number((await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text count FROM notification_deliveries
     WHERE alert_id = $1 AND sent_at > now() - ($2 || ' seconds')::interval AND status = 'delivered'`,
    [alert.id, throttleSeconds],
  )).rows[0]?.count ?? 0) > 0
  if (recentlyDelivered) return { alertId: alert.id, deliveries: 0, severity }

  const channels = normalizeChannels(trigger?.channels, severity)
  const available = configuredChannels()
  let deliveries = 0
  for (const channelName of channels) {
    const channel = available[channelName]
    if (!channel) {
      await pool.query(
        `INSERT INTO notification_deliveries(alert_id, channel, status, attempts, last_error, sent_at)
         VALUES($1, $2, 'pending_configuration', 0, 'Missing provider environment variables', now())`,
        [alert.id, channelName],
      )
      continue
    }
    const result = await channel.send({
      kind: event.metric ?? event.reason_code,
      severity,
      campaign: event.campaign_id ?? 'platform',
      message: `${event.error}${event.metric ? ` — ${event.metric}: ${event.observed ?? '?'} vs ${event.threshold ?? '?'}` : ''}`,
      dashboardUrl: event.dashboard_url ?? `${process.env.APP_URL ?? 'http://localhost:3000'}/notifications`,
      runbookUrl: event.runbook_url,
      traceId: event.trace_id,
      occurrences,
    })
    await pool.query(
      `INSERT INTO notification_deliveries(alert_id, channel, status, provider_id, attempts, last_error, sent_at)
       VALUES($1, $2, $3, $4, 1, $5, now())`,
      [alert.id, result.channel, result.status, result.provider_id ?? null, result.error ?? null],
    )
    if (result.status === 'delivered') deliveries++
  }
  return { alertId: alert.id, deliveries, severity }
}

const repository: AlertRepository = {
  async checkDeadMan(expectedIntervalSeconds, stagnantWindows, traceId) {
    const heartbeats = await pool.query<{
      worker: string
      instance_id: string
      age_seconds: number
      jobs_done_window: number
      backlog_seen: number
    }>(
      `SELECT worker, instance_id,
              extract(epoch FROM now() - last_beat_at)::int age_seconds,
              COALESCE(jobs_done_window, 0) jobs_done_window,
              COALESCE(backlog_seen, 0) backlog_seen
       FROM worker_heartbeats`,
    )
    let opened = 0
    let resolved = 0
    for (const heartbeat of heartbeats.rows) {
      const key = `${heartbeat.worker}:${heartbeat.instance_id}`
      const isStale = heartbeat.age_seconds > expectedIntervalSeconds * 3
      const isStagnant = heartbeat.backlog_seen > 0 && heartbeat.jobs_done_window === 0
      const prior = (await pool.query<{ id: string; payload: Record<string, unknown> }>(
        `SELECT id, payload FROM alerts
         WHERE kind = 'worker_dead_man' AND payload->>'worker_instance' = $1 AND resolved_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [key],
      )).rows[0]
      const windows = isStagnant ? Number(prior?.payload?.stagnant_windows ?? 0) + 1 : 0
      if (isStale || windows >= stagnantWindows) {
        await routeEvent({
          source: 'dead-man',
          worker: heartbeat.worker,
          trace_id: traceId,
          severity: 'critical',
          reason_code: 'TIMEOUT',
          error: isStale ? 'Worker heartbeat exceeded three expected intervals' : 'Worker backlog is stagnant',
          metric: isStale ? 'heartbeat_age_seconds' : 'stagnant_windows',
          observed: isStale ? heartbeat.age_seconds : windows,
          threshold: isStale ? expectedIntervalSeconds * 3 : stagnantWindows,
          runbook_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/docs/runbooks/worker-dead-man`,
          dashboard_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/system-health`,
          context: { worker_instance: key, stagnant_windows: windows },
        }, traceId)
        opened++
      } else if (prior) {
        await pool.query(
          `UPDATE alerts SET resolved_at = now(), decided_by = 'dead-man:auto-resolve'
           WHERE id = $1`,
          [prior.id],
        )
        resolved++
      }
    }
    return { opened, resolved }
  },

  async runCanaries(pipelines, timeoutMs, traceId) {
    let passed = 0
    let failed = 0
    for (const pipeline of pipelines) {
      const queue = registry.queues[pipeline]
      const events = new QueueEvents(pipeline, { connection: registry.connection })
      const startedAt = Date.now()
      const job = await queue.add('synthetic-canary', {
        synthetic: true,
        canaryOnly: true,
        canaryTraceId: traceId,
      }, { jobId: `canary:${pipeline}:${traceId}` })
      let status = 'passed'
      let error: string | null = null
      try {
        await job.waitUntilFinished(events, timeoutMs)
        passed++
      } catch (cause) {
        status = 'failed'
        error = String(cause)
        failed++
        await routeEvent({
          source: 'canary',
          worker: pipeline,
          job_id: job.id,
          trace_id: traceId,
          severity: 'critical',
          reason_code: 'TIMEOUT',
          error: 'Synthetic canary did not complete within the latency objective',
          metric: 'canary_latency_ms',
          observed: Date.now() - startedAt,
          threshold: timeoutMs,
          runbook_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/docs/runbooks/canary-failure`,
          dashboard_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/system-health`,
          context: { cause: error },
        }, traceId)
      } finally {
        await events.close()
      }
      await pool.query(
        `INSERT INTO canary_runs(pipeline, trace_id, status, latency_ms, error, finished_at)
         VALUES($1, $2, $3, $4, $5, now())`,
        [pipeline, traceId, status, Date.now() - startedAt, error],
      )
    }
    return { passed, failed }
  },

  routeError: routeEvent,
}

void installPlatformSchedulers(registry).catch((error) => {
  console.error('Unable to install platform job schedulers', error)
})
runWorker(spec.queue, createAlertProcessor(repository))

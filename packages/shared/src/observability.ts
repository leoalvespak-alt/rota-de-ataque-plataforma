import * as Sentry from '@sentry/node'
import pino from 'pino'
import { Counter, Histogram, Registry } from 'prom-client'

export const registry = new Registry()
export const jobsTotal = new Counter({ name: 'worker_jobs_total', help: 'Jobs processados', labelNames: ['worker', 'status'], registers: [registry] })
export const jobLatency = new Histogram({ name: 'worker_job_latency_seconds', help: 'Latência de jobs', labelNames: ['worker'], buckets: [.1, .5, 1, 5, 15, 60], registers: [registry] })
export const embeddingsLatency = new Histogram({ name: 'embeddings_latency_ms', help: 'Latência de embeddings', labelNames: ['model'], buckets: [10, 50, 100, 250, 500, 1000, 2500], registers: [registry] })
export const notificationsSent = new Counter({ name: 'notifications_sent_total', help: 'Notificações entregues', labelNames: ['channel', 'severity'], registers: [registry] })
export const notificationsFailed = new Counter({ name: 'notifications_failed_total', help: 'Notificações falhas', labelNames: ['channel'], registers: [registry] })
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', redact: { paths: ['*.token', '*.accessToken', '*.meta_access_token', 'req.headers.authorization'], censor: '[REDACTED]' } })
export const metaSyncPostsNew = new Counter({ name: 'meta_sync_posts_new_total', help: 'New posts synchronized from Meta API', registers: [registry] })
export const metaSyncApiErrors = new Counter({ name: 'meta_sync_api_errors_total', help: 'Meta API synchronization errors', labelNames: ['endpoint'], registers: [registry] })
export const metaSyncDuration = new Histogram({ name: 'meta_sync_duration_ms', help: 'Meta synchronization duration', buckets: [100, 250, 500, 1000, 2500, 5000, 15000, 30000], registers: [registry] })
export const extractionCoverageMetric = new Histogram({ name: 'extraction_coverage', help: 'Collected comments coverage', buckets: [.1, .25, .5, .6, .75, .9, 1], registers: [registry] })
export const classificationLatency = new Histogram({ name: 'classification_latency_ms', help: 'Classification latency', buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000], registers: [registry] })
export const classificationLlmErrors = new Counter({ name: 'classification_llm_errors_total', help: 'LLM classification failures', registers: [registry] })
export const engagementActionsTotal = new Counter({ name: 'engagement_actions_total', help: 'Conservative engagement actions', labelNames: ['action','status'], registers: [registry] })
export const engagementLatency = new Histogram({ name: 'engagement_latency_ms', help: 'Engagement action latency', buckets: [100,500,1000,2500,5000,15000,30000,60000], registers: [registry] })
export const dmColdAttemptsBlocked = new Counter({ name: 'dm_cold_attempts_blocked_total', help: 'Cold DM attempts blocked by policy', registers: [registry] })
export function initSentry(dsn?: string) { if (dsn) Sentry.init({ dsn, beforeSend(event) { if (event.request?.headers) delete event.request.headers.authorization; return event } }) }

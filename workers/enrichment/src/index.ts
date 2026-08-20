import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { assertProviderReady, reconcileBudget, releaseBudget, reserveBudget, QUEUE_NAMES } from '@plataforma/shared'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'
import { z } from 'zod'

export const spec = { queue: 'enrichment' } satisfies WorkerSpec
const gate = createWorker<EnrichmentPayload>(spec)

const uuid = z.string().uuid()
export const enrichmentPayloadSchema = z.object({
  researchRunId: uuid,
  observationId: uuid,
  provider: z.string().trim().min(1).max(64),
  platform: z.string().trim().min(1).max(32),
  correlationId: uuid,
  inputVersion: z.string().trim().min(1).max(80),
  enrichmentVersion: z.string().trim().min(1).max(80),
  estimatedCostUsd: z.number().finite().nonnegative().max(10_000),
  nextQueue: z.enum(QUEUE_NAMES).default('content-opportunity'),
  operation: z.string().trim().min(1).max(80).default('enrich'),
  maxAgeMinutes: z.number().int().positive().max(43_200).default(10_080),
  timeoutMs: z.number().int().positive().max(120_000).default(15_000),
})
export type EnrichmentPayload = z.infer<typeof enrichmentPayloadSchema>

export const enrichmentObservationSchema = z.object({
  id: uuid,
  researchRunId: uuid,
  provider: z.string(),
  platform: z.string(),
  externalId: z.string(),
  canonicalUrl: z.string(),
  logicalEntityKey: z.string(),
  authorExternalId: z.string().nullable(),
  title: z.string().nullable(),
  textContent: z.string().nullable(),
  metrics: z.record(z.string(), z.unknown()),
  rawSchemaVersion: z.string(),
  observedAt: z.string(),
  publishedAt: z.string().nullable(),
})
export type EnrichmentObservation = z.infer<typeof enrichmentObservationSchema>

export const enrichmentResponseSchema = z.object({
  classification: z.enum(['creator', 'source', 'content', 'topic']),
  displayName: z.string().trim().min(1).optional(),
  handle: z.string().trim().min(1).optional(),
  canonicalUrl: z.string().trim().min(1).optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
  actualCostUsd: z.number().finite().nonnegative().optional(),
  externalReference: z.string().trim().min(1).optional(),
})
export type EnrichmentResponse = z.infer<typeof enrichmentResponseSchema>

export type EnrichmentReasonCode =
  | 'ENRICHMENT_PAYLOAD_INVALID'
  | 'ENRICHMENT_OBSERVATION_MISSING'
  | 'ENRICHMENT_STALE_INPUT'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_CONFIG_MISSING'
  | 'BUDGET_EXCEEDED'
  | 'ENRICHMENT_TIMEOUT'
  | 'CONTENT_INSUFFICIENT'
  | 'ENRICHMENT_PROVIDER_FAILURE'
  | 'ENRICHMENT_PERSISTENCE_FAILURE'
  | 'ENRICHMENT_ALREADY_RUNNING'

export class EnrichmentError extends Error {
  constructor(
    message: string,
    public readonly reasonCode: EnrichmentReasonCode,
    public readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'EnrichmentError'
  }
}

export interface EnrichmentRuntime {
  claim(job: EnrichmentPayload, sourceJob: WorkerJob<EnrichmentPayload>): Promise<'claimed' | 'completed' | 'busy'>
  loadObservation(observationId: string): Promise<EnrichmentObservation | null>
  reserveBudget(provider: string, estimatedCostUsd: number): Promise<{ reservationId: string }>
  enrich(observation: EnrichmentObservation, job: EnrichmentPayload, signal: AbortSignal): Promise<unknown>
  persistEnrichment(input: { job: EnrichmentPayload; observation: EnrichmentObservation; result: EnrichmentResponse; reservationId: string }): Promise<void>
  reconcileBudget(reservationId: string, actualCostUsd: number): Promise<void>
  releaseBudget(reservationId: string): Promise<void>
  enqueueNext(job: EnrichmentPayload, observation: EnrichmentObservation, result: EnrichmentResponse): Promise<void>
  markCompleted(job: EnrichmentPayload, actualCostUsd: number): Promise<void>
  markFailed(job: EnrichmentPayload, reasonCode: EnrichmentReasonCode, error: unknown): Promise<void>
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

function toEnrichmentError(error: unknown): EnrichmentError {
  if (error instanceof EnrichmentError) return error
  const code = errorCode(error)
  if (code === 'BUDGET_EXCEEDED') return new EnrichmentError('Budget blocked enrichment', 'BUDGET_EXCEEDED', false, { cause: error })
  if (code === 'PROVIDER_DISABLED') return new EnrichmentError('Enrichment provider is disabled', 'PROVIDER_DISABLED', false, { cause: error })
  if (code === 'PROVIDER_NO_KEY' || code === 'PROVIDER_NO_BUDGET') return new EnrichmentError('Enrichment provider is not configured', 'PROVIDER_CONFIG_MISSING', false, { cause: error })
  return new EnrichmentError(error instanceof Error ? error.message : 'Enrichment failed', 'ENRICHMENT_PROVIDER_FAILURE', true, { cause: error })
}

function normalizeResponse(raw: unknown, observation: EnrichmentObservation): EnrichmentResponse {
  const parsed = enrichmentResponseSchema.safeParse(raw)
  if (!parsed.success) {
    const hasClassification = typeof raw === 'object' && raw !== null && 'classification' in raw
    throw new EnrichmentError(hasClassification ? 'Provider returned an invalid enrichment payload' : 'Provider returned insufficient content', hasClassification ? 'ENRICHMENT_PAYLOAD_INVALID' : 'CONTENT_INSUFFICIENT', false, { cause: parsed.error })
  }
  const displayName = parsed.data.displayName ?? observation.title ?? observation.canonicalUrl
  if (!displayName.trim()) throw new EnrichmentError('Enrichment has no display name or canonical URL', 'CONTENT_INSUFFICIENT', false)
  return { ...parsed.data, displayName, canonicalUrl: parsed.data.canonicalUrl ?? observation.canonicalUrl, confidence: parsed.data.confidence ?? 0.5 }
}

function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const task = operation(controller.signal)
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new EnrichmentError('Enrichment provider timed out', 'ENRICHMENT_TIMEOUT', true))
    }, timeoutMs)
  })
  return Promise.race([task, timeout]).finally(() => { if (timer) clearTimeout(timer) })
}

export async function executeEnrichmentJob(job: WorkerJob<EnrichmentPayload>, runtime: EnrichmentRuntime): Promise<WorkerResult> {
  const base = await gate(job)
  const parsed = enrichmentPayloadSchema.safeParse(job.payload)
  if (!parsed.success) throw new EnrichmentError('Enrichment job payload is invalid', 'ENRICHMENT_PAYLOAD_INVALID', false, { cause: parsed.error })
  const input = parsed.data
  const claim = await runtime.claim(input, job)
  if (claim === 'completed') return { ...base, event: { kind: 'enrichment.deduplicated', payload: { observationId: input.observationId, enrichmentVersion: input.enrichmentVersion, correlationId: input.correlationId } } }
  if (claim === 'busy') throw new EnrichmentError('Another enrichment attempt is already running', 'ENRICHMENT_ALREADY_RUNNING', true)

  let reservationId: string | undefined
  try {
    const observation = await runtime.loadObservation(input.observationId)
    if (!observation) throw new EnrichmentError('Observation not found', 'ENRICHMENT_OBSERVATION_MISSING', false)
    if (observation.rawSchemaVersion !== input.inputVersion) throw new EnrichmentError('Observation schema is stale for this job version', 'ENRICHMENT_STALE_INPUT', false)
    const observedAt = Date.parse(observation.observedAt)
    if (!Number.isFinite(observedAt) || Date.now() - observedAt > input.maxAgeMinutes * 60_000) throw new EnrichmentError('Observation is outside the enrichment freshness window', 'ENRICHMENT_STALE_INPUT', false)

    reservationId = (await runtime.reserveBudget(input.provider, input.estimatedCostUsd)).reservationId
    const raw = await withTimeout((signal) => runtime.enrich(observation, input, signal), input.timeoutMs)
    const result = normalizeResponse(raw, observation)
    const actualCostUsd = result.actualCostUsd ?? input.estimatedCostUsd
    await runtime.persistEnrichment({ job: input, observation, result, reservationId })
    await runtime.reconcileBudget(reservationId, actualCostUsd)
    await runtime.enqueueNext(input, observation, result)
    await runtime.markCompleted(input, actualCostUsd)
    return { ...base, event: { kind: 'enrichment.completed', payload: { observationId: input.observationId, enrichmentVersion: input.enrichmentVersion, classification: result.classification, confidence: result.confidence, nextQueue: input.nextQueue, correlationId: input.correlationId } } }
  } catch (error) {
    const normalized = toEnrichmentError(error)
    if (reservationId) await runtime.releaseBudget(reservationId).catch(() => undefined)
    await runtime.markFailed(input, normalized.reasonCode, normalized).catch(() => undefined)
    throw normalized
  }
}

function providerAdapter(): EnrichmentRuntime['enrich'] {
  return async (observation, job, signal) => {
    const endpoint = process.env.ENRICHMENT_PROVIDER_URL
    const apiKey = process.env.ENRICHMENT_PROVIDER_API_KEY
    if (!endpoint || !apiKey) throw new EnrichmentError('Enrichment provider endpoint is not configured', 'PROVIDER_CONFIG_MISSING', false)
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ observation, correlationId: job.correlationId, inputVersion: job.inputVersion, enrichmentVersion: job.enrichmentVersion }), signal })
    if (!response.ok) {
      if (response.status === 408 || response.status === 429 || response.status >= 500) throw new EnrichmentError(`Enrichment provider returned ${response.status}`, 'ENRICHMENT_PROVIDER_FAILURE', true)
      throw new EnrichmentError(`Enrichment provider returned ${response.status}`, 'ENRICHMENT_PAYLOAD_INVALID', false)
    }
    return response.json()
  }
}

type BudgetPool = Parameters<typeof reserveBudget>[0]

export function createPostgresEnrichmentRuntime(pool: BudgetPool, redisUrl: string, adapter: EnrichmentRuntime['enrich'] = providerAdapter()): EnrichmentRuntime {
  const registry = createQueueRegistry(redisUrl)
  return {
    async claim(job, sourceJob) {
      const key = `${job.observationId}:${job.enrichmentVersion}`
      const existing = await pool.query<{ status: string }>('SELECT status FROM enrichment_jobs WHERE job_key = $1', [key])
      if (existing.rows[0]?.status === 'completed') return 'completed'
      if (existing.rows[0]?.status === 'running' && sourceJob.attemptsMade === 0) return 'busy'
      const claimed = await pool.query<{ status: string }>(`INSERT INTO enrichment_jobs(job_key,observation_id,research_run_id,provider,correlation_id,input_version,enrichment_version,status,attempts)
        VALUES($1,$2,$3,$4,$5,$6,$7,'running',$8)
        ON CONFLICT(job_key) DO UPDATE SET status='running', attempts=enrichment_jobs.attempts+1, updated_at=now(), last_error=NULL
        WHERE enrichment_jobs.status <> 'completed' RETURNING status`, [key, job.observationId, job.researchRunId, job.provider, job.correlationId, job.inputVersion, job.enrichmentVersion, (sourceJob.attemptsMade ?? 0) + 1])
      return claimed.rows[0] ? 'claimed' : 'completed'
    },
    async loadObservation(observationId) {
      const result = await pool.query<Record<string, unknown>>(`SELECT id,research_run_id,provider,platform,external_id,canonical_url,logical_entity_key,author_external_id,title,text_content,metrics,raw_schema_version,observed_at,published_at FROM provider_observations WHERE id=$1`, [observationId])
      const row = result.rows[0]
      if (!row) return null
      const parsed = enrichmentObservationSchema.safeParse({ id: row.id, researchRunId: row.research_run_id, provider: row.provider, platform: row.platform, externalId: row.external_id, canonicalUrl: row.canonical_url, logicalEntityKey: row.logical_entity_key, authorExternalId: row.author_external_id, title: row.title, textContent: row.text_content, metrics: typeof row.metrics === 'object' && row.metrics !== null ? row.metrics : {}, rawSchemaVersion: row.raw_schema_version, observedAt: new Date(String(row.observed_at)).toISOString(), publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null })
      if (!parsed.success) throw new EnrichmentError('Stored observation is invalid', 'ENRICHMENT_PERSISTENCE_FAILURE', false, { cause: parsed.error })
      return parsed.data
    },
    async reserveBudget(provider, estimatedCostUsd) {
      await assertProviderReady(pool, provider, 'ENRICHMENT_ENABLED', 'ENRICHMENT_PROVIDER_API_KEY')
      return reserveBudget(pool, provider, estimatedCostUsd)
    },
    enrich: adapter,
    async persistEnrichment({ job, observation, result, reservationId }) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const entity = (await client.query<{ id: string }>(`INSERT INTO cross_platform_entities(kind,canonical_key,display_name,confidence,status) VALUES($1,$2,$3,$4,'candidate') ON CONFLICT(canonical_key) DO UPDATE SET display_name=COALESCE(EXCLUDED.display_name,cross_platform_entities.display_name),confidence=GREATEST(cross_platform_entities.confidence,EXCLUDED.confidence),updated_at=now() RETURNING id`, [result.classification, observation.logicalEntityKey, result.displayName, result.confidence])).rows[0]
        if (!entity) throw new EnrichmentError('Could not persist enriched entity', 'ENRICHMENT_PERSISTENCE_FAILURE', false)
        await client.query(`INSERT INTO cross_platform_profiles(entity_id,platform,external_id,handle,canonical_url,provenance_observation_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(platform,external_id) DO UPDATE SET entity_id=EXCLUDED.entity_id,handle=COALESCE(EXCLUDED.handle,cross_platform_profiles.handle),canonical_url=COALESCE(EXCLUDED.canonical_url,cross_platform_profiles.canonical_url),provenance_observation_id=EXCLUDED.provenance_observation_id`, [entity.id, observation.platform, observation.externalId, result.handle ?? observation.authorExternalId, result.canonicalUrl ?? observation.canonicalUrl, observation.id])
        await client.query(`UPDATE provider_observations SET metrics=metrics || $2::jsonb WHERE id=$1`, [observation.id, JSON.stringify({ enrichment: { version: job.enrichmentVersion, classification: result.classification, confidence: result.confidence, correlationId: job.correlationId } })])
        await client.query(`INSERT INTO provider_usage(research_run_id,provider,operation,units,estimated_cost_usd,actual_cost_usd,attempts,outcome,external_reference,pricing_version) VALUES($1,$2,$3,1,$4,$5,$6,'completed',$7,'enrichment-v1')`, [job.researchRunId, job.provider, job.operation, job.estimatedCostUsd, result.actualCostUsd ?? job.estimatedCostUsd, 1, result.externalReference ?? null])
        await client.query(`UPDATE enrichment_jobs SET status='persisting',actual_cost_usd=$2,updated_at=now() WHERE job_key=$1`, [`${job.observationId}:${job.enrichmentVersion}`, result.actualCostUsd ?? job.estimatedCostUsd])
        void reservationId
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error instanceof EnrichmentError ? error : new EnrichmentError('Could not persist enrichment transaction', 'ENRICHMENT_PERSISTENCE_FAILURE', true, { cause: error })
      } finally { client.release() }
    },
    async reconcileBudget(reservationId, actualCostUsd) { await reconcileBudget(pool, reservationId, actualCostUsd) },
    async releaseBudget(reservationId) { await releaseBudget(pool, reservationId) },
    async enqueueNext(job, observation, result) {
      const next = registry.queues[job.nextQueue]
      await enqueueOnce(next, job.nextQueue, [observation.id, job.enrichmentVersion], { observationId: observation.id, researchRunId: job.researchRunId, correlationId: job.correlationId, enrichmentVersion: job.enrichmentVersion, classification: result.classification, source: 'enrichment' })
      await pool.query('UPDATE enrichment_jobs SET next_enqueued_at=COALESCE(next_enqueued_at,now()),updated_at=now() WHERE job_key=$1', [`${job.observationId}:${job.enrichmentVersion}`])
    },
    async markCompleted(job, actualCostUsd) { await pool.query(`UPDATE enrichment_jobs SET status='completed',reason_code='SUCCESS',actual_cost_usd=$2,completed_at=now(),updated_at=now() WHERE job_key=$1`, [`${job.observationId}:${job.enrichmentVersion}`, actualCostUsd]) },
    async markFailed(job, reasonCode, error) { await pool.query(`UPDATE enrichment_jobs SET status='failed',reason_code=$2,last_error=$3,updated_at=now() WHERE job_key=$1`, [`${job.observationId}:${job.enrichmentVersion}`, reasonCode, error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240)]) },
  }
}

let defaultRuntime: EnrichmentRuntime | undefined
function getDefaultRuntime(): EnrichmentRuntime {
  if (defaultRuntime) return defaultRuntime
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new EnrichmentError('DATABASE_URL is required for enrichment', 'PROVIDER_CONFIG_MISSING', false)
  defaultRuntime = createPostgresEnrichmentRuntime(createDatabase(databaseUrl).pool, process.env.REDIS_URL ?? 'redis://localhost:6379')
  return defaultRuntime
}

export const processJob = (job: WorkerJob<EnrichmentPayload>) => executeEnrichmentJob(job, getDefaultRuntime())

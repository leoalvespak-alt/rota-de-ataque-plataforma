import {
  PREREQUISITE_DEFINITIONS,
  type PrerequisiteKey,
} from '@plataforma/shared/client'

export interface PrerequisiteResult {
  key: PrerequisiteKey
  satisfied: boolean
  label_pt: string
  href: string
}

interface Queryable {
  query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>
}

interface RedisReadable {
  get(key: string): Promise<string | null>
}

interface PrerequisiteFacts {
  has_sources: boolean
  has_connected_account: boolean
  has_actor: boolean
  has_policy: boolean
  has_ai: boolean
  has_thesis: boolean
  has_approved_variant: boolean
  has_budget: boolean
}

async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 3_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function embeddingsHealthy(
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const endpoint = env.EMBEDDINGS_ENDPOINT?.replace(/\/$/u, '')
  if (!endpoint) return false
  try {
    const response = await fetchImpl(`${endpoint}/info`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function evaluateAutomationPrerequisites(
  database: Queryable,
  redis: RedisReadable,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<PrerequisiteResult[]> {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const { rows } = await database.query<PrerequisiteFacts>(`
    SELECT
      EXISTS(SELECT 1 FROM news_sources WHERE active = true) AS has_sources,
      EXISTS(SELECT 1 FROM accounts WHERE status = 'HEALTHY') AS has_connected_account,
      EXISTS(SELECT 1 FROM accounts WHERE role = 'actor' AND status = 'HEALTHY') AS has_actor,
      EXISTS(SELECT 1 FROM contact_policies WHERE enabled IS DISTINCT FROM false) AS has_policy,
      EXISTS(
        SELECT 1
        FROM ai_models model
        JOIN ai_providers provider ON provider.id = model.provider_id
        WHERE model.enabled
          AND provider.enabled
          AND provider.deleted_at IS NULL
          AND (provider.kind = 'local' OR provider.secret_configured)
      ) AS has_ai,
      EXISTS(SELECT 1 FROM theses WHERE active IS DISTINCT FROM false) AS has_thesis,
      EXISTS(SELECT 1 FROM content_variants WHERE status = 'approved') AS has_approved_variant,
      EXISTS(SELECT 1 FROM organic_budgets WHERE limit_usd > 0) AS has_budget
  `)
  const facts = rows[0] ?? {
    has_sources: false,
    has_connected_account: false,
    has_actor: false,
    has_policy: false,
    has_ai: false,
    has_thesis: false,
    has_approved_variant: false,
    has_budget: false,
  }
  const [killSwitchValue, embeddingsOk] = await Promise.all([
    withTimeout(redis.get('kill-switch:global').catch(() => '1'), '1'),
    embeddingsHealthy(env, fetchImpl),
  ])
  const environmentAiConfigured = Boolean(
    env.LLM_MODEL?.trim()
      && (env.LLM_PROVIDER === 'anthropic' || env.LLM_ENDPOINT?.trim()),
  )

  const satisfied: Record<PrerequisiteKey, boolean> = {
    news_source_active: facts.has_sources,
    connected_account_healthy: facts.has_connected_account,
    budget_ceiling_set: facts.has_budget,
    embeddings_healthy: embeddingsOk,
    ai_provider_configured: facts.has_ai || environmentAiConfigured,
    thesis_exists: facts.has_thesis,
    actor_account_healthy: facts.has_actor,
    kill_switch_off: killSwitchValue !== '1',
    approved_variant_exists: facts.has_approved_variant,
    contact_policy_configured: facts.has_policy,
  }

  return PREREQUISITE_DEFINITIONS.map((definition) => ({
    ...definition,
    satisfied: satisfied[definition.key],
  }))
}

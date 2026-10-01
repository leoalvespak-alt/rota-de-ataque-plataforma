export interface JevAutoConfig {
  enabled: boolean
  minRelevance: number
  minConfidence: number
  minFactuality: number
  minPreserved: number
  trustedSources: string[]
  model: string
  timeoutMs: number
}

export interface AutoEvidence {
  jevPreserved: number
  minRelevance: number
  minConfidence: number
  minFactuality: number
  minPreserved: number
  trustedSource: string
}

const DEFAULT_TRUSTED_SOURCES = ['pci concursos', 'folha dirigida', 'ache concursos']

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function loadJevAutoConfig(env: NodeJS.ProcessEnv = process.env): JevAutoConfig {
  const trustedRaw = env.RADAR_AUTO_TRUSTED_SOURCES ?? DEFAULT_TRUSTED_SOURCES.join(',')
  return {
    enabled: env.RADAR_AUTO_CONTENT_ENABLED === 'true',
    minRelevance: parseNumber(env.RADAR_AUTO_MIN_RELEVANCE, 0.8),
    minConfidence: parseNumber(env.RADAR_AUTO_MIN_CONFIDENCE, 0.8),
    minFactuality: parseNumber(env.RADAR_AUTO_MIN_FACTUALITY, 0.8),
    minPreserved: parseNumber(env.RADAR_AUTO_MIN_PRESERVED, 0.8),
    trustedSources: trustedRaw.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean),
    model: env.RADAR_JEV_MODEL?.trim() || '~typesafe/jev-latest',
    timeoutMs: parseNumber(env.RADAR_JEV_TIMEOUT_MS, 20000),
  }
}

export function normalizeSourceName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

export function isTrustedSource(sourceName: string | null | undefined, trustedSources: string[]): boolean {
  const normalized = normalizeSourceName(sourceName)
  if (!normalized) return false
  return trustedSources.some((trusted) => trusted && normalized.includes(trusted))
}

export interface FactualCheck {
  preserved: number
  costUsd: number | null
  model: string | null
  inputTokens: number | null
}

export async function verifyFactualPreserved(input: {
  title: string
  summary: string | null
  apiKey: string
  model: string
  timeoutMs: number
  signal?: AbortSignal
}): Promise<FactualCheck | null> {
  if (!input.apiKey.trim() || !input.title.trim()) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('JEV timeout')), input.timeoutMs)
  const onAbort = () => controller.abort()
  input.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://design.rotadeataque.com.br',
        'X-Title': 'Rota Editorial JEV auto-gate',
      },
      body: JSON.stringify({
        model: input.model,
        state: {
          titulo: input.title.slice(0, 300),
          resumo: (input.summary ?? '').slice(0, 500),
        },
        questions: {
          trava_factual: {
            type: 'noul',
            instructions: 'O resumo contradiz o titulo ou extrapola os fatos do titulo com informacoes novas?',
            labels: { yes: 'Contradiz ou extrapola', no: 'Coerente com o titulo' },
          },
        },
      }),
    })
    if (!response.ok) return null
    const data = (await response.json().catch(() => null)) as {
      answers?: { trava_factual?: { type?: string; noul?: number } }
      usage?: { cost?: number; input_tokens?: number }
      model?: string
    } | null
    const changed = data?.answers?.trava_factual?.noul
    if (typeof changed !== 'number' || !Number.isFinite(changed)) return null
    return {
      preserved: 1 - changed,
      costUsd: typeof data?.usage?.cost === 'number' ? data.usage.cost : null,
      model: data?.model ?? input.model,
      inputTokens: typeof data?.usage?.input_tokens === 'number' ? data.usage.input_tokens : null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', onAbort)
  }
}

export function scoresPassGate(
  scores: { relevance: number; confidence: number; factuality: number },
  config: JevAutoConfig,
): boolean {
  return (
    scores.relevance >= config.minRelevance &&
    scores.confidence >= config.minConfidence &&
    scores.factuality >= config.minFactuality
  )
}

export function buildAutoEvidence(input: {
  jevPreserved: number
  sourceName: string | null | undefined
  config: JevAutoConfig
}): AutoEvidence {
  return {
    jevPreserved: input.jevPreserved,
    minRelevance: input.config.minRelevance,
    minConfidence: input.config.minConfidence,
    minFactuality: input.config.minFactuality,
    minPreserved: input.config.minPreserved,
    trustedSource: normalizeSourceName(input.sourceName),
  }
}

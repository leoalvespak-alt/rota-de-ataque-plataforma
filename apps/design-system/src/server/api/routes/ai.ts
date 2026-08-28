import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { aiJobs, aiTokenLogs, apiIdempotency } from '@/db/schema'
import { getAuthenticatedUserId, rateLimit, requireAuth } from '../auth'
import { db } from '../db'
import { ApiError, body } from './helpers'

type Capability = 'text' | 'image' | 'json' | 'streaming'
type Provider = 'deepseek' | 'claude' | 'fal'
interface ModelConfig {
  id: string
  label: string
  provider: Provider
  model: string
  capabilities: Capability[]
  url: string
  keyEnv: 'DEEPSEEK_API_KEY_DESIGN_SYSTEM' | 'ANTHROPIC_API_KEY' | 'FAL_API_KEY'
  inputUsdPerMillion?: number
  outputUsdPerMillion?: number
}

const PROMPT_VERSION = 'design-copy-v2'
const PARAMETER_VERSION = 'design-ai-params-v1'
const IA_USAGE_ENDPOINT = process.env.IA_USAGE_ENDPOINT ?? ''
const IA_USAGE_KEY = process.env.IA_USAGE_KEY ?? ''

function reportDesignIaUsage(event: Record<string, unknown>): void {
  if (!IA_USAGE_ENDPOINT || !IA_USAGE_KEY) return
  void fetch(IA_USAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-key': IA_USAGE_KEY },
    body: JSON.stringify({ events: [{ bucket: 'design_system', projeto: 'design_system', ...event }] }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined)
}
const MODELS: ModelConfig[] = [
  { id: 'deepseek-default', label: 'DeepSeek Chat', provider: 'deepseek', model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat', capabilities: ['text', 'json'], url: 'https://api.deepseek.com/chat/completions', keyEnv: 'DEEPSEEK_API_KEY_DESIGN_SYSTEM', inputUsdPerMillion: 0.28, outputUsdPerMillion: 0.42 },
  { id: 'claude-default', label: 'Claude Sonnet', provider: 'claude', model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514', capabilities: ['text', 'json'], url: 'https://api.anthropic.com/v1/messages', keyEnv: 'ANTHROPIC_API_KEY', inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  { id: 'fal-flux-schnell', label: 'FLUX Schnell', provider: 'fal', model: 'fal-ai/flux/schnell', capabilities: ['image'], url: 'https://queue.fal.run/fal-ai/flux/schnell', keyEnv: 'FAL_API_KEY' },
]
const ALLOWED_HOSTS = new Set(['api.deepseek.com', 'api.anthropic.com', 'queue.fal.run', 'fal.run', 'rest.alpha.fal.ai'])
const isAllowedHost = (hostname: string) => ALLOWED_HOSTS.has(hostname) || hostname === 'fal.media' || hostname.endsWith('.fal.media')

function modelConfig(id: string, capability: Capability): ModelConfig {
  const config = MODELS.find((model) => model.id === id && model.capabilities.includes(capability))
  if (!config) throw new ApiError(400, 'Modelo não permitido para esta operação.')
  return config
}

function providerKey(config: ModelConfig): string {
  const key = process.env[config.keyEnv] ?? (config.provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : undefined)
  if (!key) throw new ApiError(503, `Provider ${config.provider} não configurado.`)
  return key
}

function allowedUrl(value: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new ApiError(502, 'Provider retornou URL inválida.') }
  if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) throw new ApiError(502, 'Provider retornou destino não permitido.')
  return url
}

const circuits = new Map<Provider, { failures: number; openedUntil: number }>()
function assertCircuit(provider: Provider) {
  const circuit = circuits.get(provider)
  if (circuit && circuit.openedUntil > Date.now()) throw new ApiError(503, `Provider ${provider} temporariamente indisponível.`)
}
function recordSuccess(provider: Provider) { circuits.delete(provider) }
function recordFailure(provider: Provider) {
  const current = circuits.get(provider) ?? { failures: 0, openedUntil: 0 }
  current.failures += 1
  if (current.failures >= 5) current.openedUntil = Date.now() + 60_000
  circuits.set(provider, current)
}

async function providerFetch(config: ModelConfig, url: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> {
  allowedUrl(url)
  assertCircuit(config.provider)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const start = Date.now()
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      console.log(JSON.stringify({
        level: 'info', event: 'provider_call',
        provider: config.provider, model: config.model,
        attempt, statusCode: response.status,
        latencyMs: Date.now() - start,
      }))
      if (response.ok) { recordSuccess(config.provider); return response }
      if (![429, 502, 503, 504].includes(response.status) || attempt === 2) {
        recordFailure(config.provider)
        throw new ApiError(response.status === 429 ? 429 : 502, 'Provider recusou a operação.')
      }
    } catch (error) {
      if (error instanceof ApiError && error.status !== 429 && error.status !== 502) throw error
      if (attempt === 2) { recordFailure(config.provider); throw new ApiError(502, 'Provider temporariamente indisponível.') }
    } finally {
      clearTimeout(timer)
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
  }
  throw new ApiError(502, 'Provider temporariamente indisponível.')
}

async function generateText(config: ModelConfig, prompt: string, systemPrompt: string, maxTokens: number, temperature: number) {
  const key = providerKey(config)
  const anthropic = config.provider === 'claude'
  const response = await providerFetch(config, config.url, {
    method: 'POST',
    headers: anthropic
      ? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
      : { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(anthropic ? {
      model: config.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    } : {
      model: config.model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    }),
  })
  if (anthropic) {
    const payload = await response.json() as {
      content?: Array<{ text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    return {
      content: payload.content?.[0]?.text ?? '',
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
    }
  }
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    content: payload.choices?.[0]?.message?.content ?? '',
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
  }
}

async function generateTextWithFallback(
  preferredModelId: string,
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; inputTokens: number; outputTokens: number; config: ModelConfig; fallbackUsed: boolean }> {
  const preferred = modelConfig(preferredModelId, 'text')
  try {
    const result = await generateText(preferred, prompt, systemPrompt, maxTokens, temperature)
    return { ...result, config: preferred, fallbackUsed: false }
  } catch (error) {
    if (!(error instanceof ApiError) || ![502, 503].includes(error.status)) throw error
    const fallback = MODELS.find(m =>
      m.id !== preferredModelId &&
      m.capabilities.includes('text') &&
      process.env[m.keyEnv]
    )
    if (!fallback) throw error
    const result = await generateText(fallback, prompt, systemPrompt, maxTokens, temperature)
    return { ...result, config: fallback, fallbackUsed: true }
  }
}

const copySchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(20_000),
  systemPrompt: z.string().min(1).max(8_000),
  maxTokens: z.number().int().min(1).max(8192).default(400),
  temperature: z.number().min(0).max(1.5).default(0.7),
  idempotencyKey: z.string().min(8).max(200).optional(),
})
const imageSchema = z.object({
  provider: z.literal('fal'),
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(4000),
  style: z.string().max(500).default(''),
  idempotencyKey: z.string().min(8).max(200).optional(),
})
const providerTestSchema = z.object({ model: z.string().min(1).max(100) })

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function beginIdempotent(userId: string, scope: string, key: string | undefined, payload: unknown) {
  if (!key) return null
  const requestHash = hash(payload)
  const [created] = await db.insert(apiIdempotency).values({
    userId, scope, key, requestHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).onConflictDoNothing().returning()
  if (created) return created
  const [existing] = await db.select().from(apiIdempotency).where(and(
    eq(apiIdempotency.userId, userId), eq(apiIdempotency.scope, scope), eq(apiIdempotency.key, key),
  ))
  if (!existing || existing.requestHash !== requestHash) throw new ApiError(409, 'Chave de idempotência reutilizada com conteúdo diferente.')
  if (existing.status === 'completed' && existing.response) return existing
  throw new ApiError(409, 'Operação idempotente ainda está em andamento.')
}

async function completeIdempotent(id: string | undefined, response: Record<string, unknown>) {
  if (id) await db.update(apiIdempotency).set({ status: 'completed', response }).where(eq(apiIdempotency.id, id))
}

async function runIdempotent(
  userId: string,
  scope: string,
  key: string | undefined,
  payload: unknown,
  operation: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const record = await beginIdempotent(userId, scope, key, payload)
  if (record?.status === 'completed' && record.response) return record.response
  try {
    const response = await operation()
    await completeIdempotent(record?.id, response)
    return response
  } catch (error) {
    if (record?.id) await db.delete(apiIdempotency).where(eq(apiIdempotency.id, record.id)).catch(() => undefined)
    throw error
  }
}

export const aiRoutes = new Hono()
  .get('/catalog', requireAuth, (c) => {
    const models = MODELS.map((model) => ({
      id: model.id, label: model.label, provider: model.provider, model: model.model,
      capabilities: model.capabilities, enabled: true, configured: Boolean(process.env[model.keyEnv]),
    }))
    const providers = [...new Set(MODELS.map((model) => model.provider))].map((provider) => {
      const circuitState = circuits.get(provider)
      return {
        id: provider,
        label: provider === 'claude' ? 'Anthropic' : provider === 'fal' ? 'fal.ai' : 'DeepSeek',
        capabilities: [...new Set(MODELS.filter((model) => model.provider === provider).flatMap((model) => model.capabilities))],
        configured: MODELS.some((model) => model.provider === provider && process.env[model.keyEnv]),
        circuitOpen: Boolean(circuitState && circuitState.openedUntil > Date.now()),
        circuitResetAt: circuitState?.openedUntil ? new Date(circuitState.openedUntil).toISOString() : null,
        consecutiveFailures: circuitState?.failures ?? 0,
      }
    })
    return c.json({ models, providers })
  })
  .get('/status', requireAuth, (c) => {
    const providers = [...new Set(MODELS.map((model) => model.provider))].map((provider) => {
      const circuitState = circuits.get(provider)
      return {
        id: provider,
        configured: MODELS.some((model) => model.provider === provider && process.env[model.keyEnv]),
        circuitOpen: Boolean(circuitState && circuitState.openedUntil > Date.now()),
        consecutiveFailures: circuitState?.failures ?? 0,
      }
    })
    return c.json({ providers })
  })
  .post('/copy/generate', requireAuth, rateLimit(20, 60_000), async (c) => {
    const data = await body(c, copySchema)
    const userId = getAuthenticatedUserId(c)
    const key = c.req.header('Idempotency-Key') ?? data.idempotencyKey
    const response = await runIdempotent(userId, 'ai-copy', key, data, async () => {
      const result = await generateTextWithFallback(data.model, data.prompt, data.systemPrompt, data.maxTokens, data.temperature)
      const config = result.config
      const cost = ((result.inputTokens * (config.inputUsdPerMillion ?? 0)) + (result.outputTokens * (config.outputUsdPerMillion ?? 0))) / 1_000_000
      await db.insert(aiTokenLogs).values({
        userId, model: config.model, provider: config.provider, operation: 'copy_generate',
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens, costUsd: cost.toFixed(8),
        metadata: { promptVersion: PROMPT_VERSION, parameterVersion: PARAMETER_VERSION },
      })
      reportDesignIaUsage({ feature: 'design_copy_generate', provider: config.provider, model: config.model, input_tokens: result.inputTokens, output_tokens: result.outputTokens, success: true, user_id: userId, metadata: { operation: 'copy_generate', promptVersion: PROMPT_VERSION, parameterVersion: PARAMETER_VERSION } })
      return { content: result.content, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: cost }, provider: config.provider, model: config.model, promptVersion: PROMPT_VERSION, parameterVersion: PARAMETER_VERSION, fallbackUsed: result.fallbackUsed }
    })
    return c.json(response)
  })
  .post('/image/submit', requireAuth, rateLimit(5, 60_000), async (c) => {
    const data = await body(c, imageSchema)
    const userId = getAuthenticatedUserId(c)
    const key = c.req.header('Idempotency-Key') ?? data.idempotencyKey
    const result = await runIdempotent(userId, 'ai-image', key, data, async () => {
      const config = modelConfig(data.model, 'image')
      const response = await providerFetch(config, config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${providerKey(config)}` },
        body: JSON.stringify({ prompt: data.style ? `${data.prompt}, ${data.style}` : data.prompt, image_size: 'square_hd', num_inference_steps: 4, num_images: 1, enable_safety_checker: true }),
      }, 45_000)
      const payload = await response.json() as { request_id?: string; status_url?: string; response_url?: string; status?: string }
      if (!payload.request_id || !payload.status_url || !payload.response_url) throw new ApiError(502, 'Provider retornou job incompleto.')
      allowedUrl(payload.status_url); allowedUrl(payload.response_url)
      const [job] = await db.insert(aiJobs).values({
        userId, provider: config.provider, modelId: config.id, providerRequestId: payload.request_id,
        status: payload.status ?? 'IN_QUEUE', statusUrl: payload.status_url, responseUrl: payload.response_url,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }).returning()
      return { requestId: job!.id, status: job!.status }
    })
    return c.json(result, 202)
  })
  .get('/jobs/:id', requireAuth, rateLimit(60, 60_000), async (c) => {
    const userId = getAuthenticatedUserId(c)
    const [job] = await db.select().from(aiJobs).where(and(eq(aiJobs.id, c.req.param('id')), eq(aiJobs.userId, userId)))
    if (!job) throw new ApiError(404, 'Job não encontrado.')
    if (job.expiresAt <= new Date()) {
      await db.update(aiJobs).set({ status: 'EXPIRED', updatedAt: new Date() }).where(eq(aiJobs.id, job.id))
      return c.json({ requestId: job.id, status: 'EXPIRED', error: 'Job expirado.' })
    }
    if (job.status === 'COMPLETED' || job.status === 'FAILED') return c.json({ requestId: job.id, status: job.status, imageUrl: job.imageUrl, error: job.error })
    const config = modelConfig(job.modelId, 'image')
    const statusResponse = await providerFetch(config, job.statusUrl, { headers: { Authorization: `Key ${providerKey(config)}` } })
    const statusPayload = await statusResponse.json() as { status?: string; error?: string }
    const status = statusPayload.status ?? 'IN_PROGRESS'
    if (status === 'FAILED') {
      await db.update(aiJobs).set({ status, error: 'Geração recusada pelo provider.', updatedAt: new Date() }).where(eq(aiJobs.id, job.id))
      return c.json({ requestId: job.id, status, error: 'Geração recusada pelo provider.' })
    }
    if (status !== 'COMPLETED') {
      await db.update(aiJobs).set({ status, updatedAt: new Date() }).where(eq(aiJobs.id, job.id))
      return c.json({ requestId: job.id, status })
    }
    const resultResponse = await providerFetch(config, job.responseUrl, { headers: { Authorization: `Key ${providerKey(config)}` } })
    const resultPayload = await resultResponse.json() as { images?: Array<{ url?: string }> }
    const imageUrl = resultPayload.images?.[0]?.url
    if (!imageUrl) throw new ApiError(502, 'Provider concluiu sem imagem válida.')
    allowedUrl(imageUrl)
    await db.update(aiJobs).set({ status: 'COMPLETED', imageUrl, updatedAt: new Date() }).where(eq(aiJobs.id, job.id))
    return c.json({ requestId: job.id, status: 'COMPLETED', imageUrl })
  })
  .post('/providers/:provider/test', requireAuth, rateLimit(10, 60_000), async (c) => {
    const provider = c.req.param('provider') as Provider
    const data = await body(c, providerTestSchema)
    const config = MODELS.find((model) => model.id === data.model && model.provider === provider)
    if (!config) throw new ApiError(400, 'Provider e modelo não correspondem.')
    const startedAt = Date.now()
    if (config.capabilities.includes('text')) await generateText(config, 'Responda apenas OK.', 'Teste de conectividade.', 5, 0)
    else {
      await providerFetch(config, 'https://rest.alpha.fal.ai/models?limit=1', { headers: { Authorization: `Key ${providerKey(config)}` } })
    }
    return c.json({ success: true, latency: Date.now() - startedAt, provider, testedAt: new Date().toISOString() })
  })

import { z } from 'zod'

const runSchema = z.object({ data: z.object({ id: z.string(), status: z.string(), defaultDatasetId: z.string().nullable().optional() }) })
export interface ApifyActorVersion { actorId: string; schemaVersion: string }
export class ApifyClient {
  constructor(private readonly token: string, private readonly endpoint = 'https://api.apify.com/v2') {}
  isConfigured() { return this.token.trim().length > 0 }
  async start(actor: ApifyActorVersion, input: unknown, options: { signal?: AbortSignal; webhookUrl?: string } = {}) {
    if (!this.isConfigured()) throw new Error('APIFY_NOT_CONFIGURED')
    const url = new URL(`${this.endpoint}/acts/${encodeURIComponent(actor.actorId)}/runs`)
    if (options.webhookUrl) url.searchParams.set('webhooks', JSON.stringify([{ eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'], requestUrl: options.webhookUrl }]))
    return runSchema.parse(await request(url, this.token, { ...input as object, _schemaVersion: actor.schemaVersion }, options.signal))
  }
  async status(runId: string, signal?: AbortSignal) {
    const url = new URL(`${this.endpoint}/actor-runs/${encodeURIComponent(runId)}`)
    return runSchema.parse(await request(url, this.token, undefined, signal, 'GET'))
  }
  async dataset(datasetId: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
    const url = new URL(`${this.endpoint}/datasets/${encodeURIComponent(datasetId)}/items`); url.searchParams.set('clean', 'true'); url.searchParams.set('limit', '500')
    const value = await request(url, this.token, undefined, signal, 'GET')
    return z.array(z.record(z.string(), z.unknown())).parse(value)
  }
}
async function request(url: URL, token: string, payload?: unknown, signal?: AbortSignal, method = 'POST'): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) })
    if (response.ok) return response.json()
    if (![429, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`APIFY_HTTP_${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
  }
  throw new Error('APIFY_UNAVAILABLE')
}

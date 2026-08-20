import { z } from 'zod'

export const FALLBACK_REASONS = ['primary_not_supported', 'primary_failed', 'primary_incomplete', 'validation_sample'] as const
export type FallbackReason = typeof FALLBACK_REASONS[number]
const responseSchema = z.object({ snapshot_id: z.string().optional(), status: z.string().optional(), data: z.array(z.record(z.string(), z.unknown())).optional() })
export class BrightDataClient {
  constructor(private readonly apiKey: string, private readonly datasetId: string, private readonly endpoint = 'https://api.brightdata.com/datasets/v3') {}
  isConfigured() { return this.apiKey.trim().length > 0 && this.datasetId.trim().length > 0 }
  async collect(input: { urls: string[]; reason: FallbackReason; signal?: AbortSignal }) {
    if (!this.isConfigured()) throw new Error('BRIGHT_DATA_NOT_CONFIGURED')
    if (!FALLBACK_REASONS.includes(input.reason)) throw new Error('FALLBACK_REASON_REQUIRED')
    if (input.urls.length < 1 || input.urls.length > 10) throw new Error('INVALID_SAMPLE_SIZE')
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.endpoint}/trigger?dataset_id=${encodeURIComponent(this.datasetId)}&include_errors=true`, {
        method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input.urls.map((url) => ({ url }))),
        signal: input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
      })
      if (response.ok) return responseSchema.parse(await response.json())
      if (![429, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`BRIGHT_DATA_HTTP_${response.status}`)
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
    }
    throw new Error('BRIGHT_DATA_UNAVAILABLE')
  }
  async status(snapshotId: string, signal?: AbortSignal) {
    return responseSchema.parse(await this.get(`/progress/${encodeURIComponent(snapshotId)}`, signal))
  }
  async data(snapshotId: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
    return z.array(z.record(z.string(), z.unknown())).max(500).parse(await this.get(`/snapshot/${encodeURIComponent(snapshotId)}?format=json`, signal))
  }
  private async get(path: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(`${this.endpoint}${path}`, { headers: { Authorization: `Bearer ${this.apiKey}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`BRIGHT_DATA_HTTP_${response.status}`)
    return response.json()
  }
}

export interface IaUsageEvent {
  feature: string
  provider?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  latency_ms?: number
  success?: boolean
  error_code?: string | null
  request_id?: string | null
  metadata?: Record<string, unknown>
}

export function reportIaUsage(event: IaUsageEvent): void {
  const endpoint = process.env.IA_USAGE_ENDPOINT
  const key = process.env.IA_USAGE_KEY
  if (!endpoint || !key) return

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-key': key },
    body: JSON.stringify({
      events: [{
        provider: 'deepseek',
        bucket: 'prospector',
        projeto: 'prospector',
        model: process.env.LLM_MODEL ?? 'deepseek-v4-flash',
        ...event,
      }],
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined)
}

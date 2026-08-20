import type { AIModel } from '@/stores/useAIStore'
import { apiFetch } from '@/lib/api/client'

export interface ConnectionTestResult {
  success: boolean
  latency?: number
  error?: string
}

/** Tests the server-side adapter. Provider credentials never enter the browser. */
export function testConnection(model: AIModel): Promise<ConnectionTestResult> {
  return apiFetch(`/ai/providers/${model.provider}/test`, {
    method: 'POST',
    body: JSON.stringify({ model: model.id }),
  })
}

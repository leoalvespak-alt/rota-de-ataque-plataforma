import { apiFetch } from '@/lib/api/client'

interface ImageJob {
  requestId: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED'
  imageUrl?: string
  error?: string
}

export async function generateImage(params: {
  model: string
  promptText: string
  style: string
  signal?: AbortSignal
  idempotencyKey?: string
  onStatus?: (message: string) => void
}): Promise<string> {
  const submitted = await apiFetch<ImageJob>('/ai/image/submit', {
    method: 'POST',
    signal: params.signal,
    headers: params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : undefined,
    body: JSON.stringify({
      provider: 'fal',
      model: params.model,
      prompt: params.promptText,
      style: params.style,
      idempotencyKey: params.idempotencyKey,
    }),
  })

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const job = attempt === 0 ? submitted : await apiFetch<ImageJob>(`/ai/jobs/${submitted.requestId}`, { signal: params.signal })
    params.onStatus?.(job.status === 'IN_QUEUE' ? 'Imagem na fila…' : job.status === 'IN_PROGRESS' ? 'Gerando imagem…' : 'Finalizando…')
    if (job.status === 'COMPLETED' && job.imageUrl) return job.imageUrl
    if (job.status === 'FAILED' || job.status === 'EXPIRED') throw new Error(job.error ?? `Job ${job.status.toLowerCase()}.`)
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1500)
      params.signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    })
  }
  throw new Error('Tempo limite excedido ao gerar a imagem.')
}

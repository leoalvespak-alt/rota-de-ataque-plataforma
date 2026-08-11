/**
 * Espelha generateImage() do Gerador/index.html original (linha 4348) — mesmo
 * endpoint fal-ai/flux/schnell, mesmo fluxo de submit + polling (até 30 tentativas
 * de 1s), mesma composição de prompt (descrição + estilo).
 */
export async function generateImage(params: {
  falKey: string
  promptText: string
  style: string
  onStatus?: (msg: string) => void
}): Promise<string> {
  const { falKey, promptText, style, onStatus } = params
  const fullPrompt = style ? `${promptText}, ${style}` : promptText

  onStatus?.('Gerando imagem... (~5-10s)')

  const submitResp = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  })

  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}))
    throw new Error(err?.detail || `HTTP ${submitResp.status}`)
  }

  const submitData = await submitResp.json()

  if (submitData?.images?.[0]?.url) {
    return submitData.images[0].url as string
  }

  if (!submitData?.request_id) {
    throw new Error('Resposta inesperada da API fal.ai.')
  }

  const requestId = submitData.request_id
  onStatus?.('Processando...')

  for (let attempts = 1; attempts <= 30; attempts++) {
    await new Promise((r) => setTimeout(r, 1000))

    const pollResp = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`, {
      headers: { Authorization: `Key ${falKey}` },
    })
    if (!pollResp.ok) continue

    const pollData = await pollResp.json()
    if (pollData?.status === 'COMPLETED' && pollData?.output?.images?.[0]?.url) {
      return pollData.output.images[0].url as string
    }
    if (pollData?.status === 'FAILED') {
      throw new Error('Geração falhou no servidor fal.ai.')
    }
    onStatus?.(`Processando... (${attempts}s)`)
  }

  throw new Error('Timeout — tente novamente.')
}

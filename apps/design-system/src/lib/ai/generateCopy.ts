import type { AIModel } from '@/stores/useAIStore'
import { apiFetch } from '@/lib/api/client'
import { validateCopyResponse } from './validateCopy'

interface GenerateOptions {
  signal?: AbortSignal
  idempotencyKey?: string
}

async function requestCopy(params: {
  model: AIModel
  prompt: string
  systemPrompt: string
  maxTokens: number
  options?: GenerateOptions
}): Promise<string> {
  const result = await apiFetch<{ content: string }>('/ai/copy/generate', {
    method: 'POST',
    signal: params.options?.signal,
    headers: params.options?.idempotencyKey
      ? { 'Idempotency-Key': params.options.idempotencyKey }
      : undefined,
    body: JSON.stringify({
      model: params.model.id,
      prompt: params.prompt,
      systemPrompt: params.systemPrompt,
      maxTokens: params.maxTokens,
      idempotencyKey: params.options?.idempotencyKey,
    }),
  })
  return result.content
}

function careerDescription(career: 'fiscal' | 'policial' | 'tribunal' | 'geral'): string {
  if (career === 'fiscal') return 'carreiras fiscais (SEFAZ, Receita Federal, Auditor)'
  if (career === 'policial') return 'carreiras policiais (PF, PRF, PC, PCDF)'
  if (career === 'tribunal') return 'tribunais (TRF, TCU, TCE, STJ)'
  return 'concursos públicos em geral'
}

export async function generateCopy(params: {
  model: AIModel
  prompt: string
  career: 'fiscal' | 'policial' | 'tribunal' | 'geral'
  availableFields: string[]
  signal?: AbortSignal
  idempotencyKey?: string
}): Promise<Record<string, string>> {
  const systemPrompt = `Você é um copywriter tático da Rota de Ataque para ${careerDescription(params.career)}.
Retorne APENAS um objeto JSON válido com as chaves: ${params.availableFields.map((field) => `"${field}"`).join(', ')}.
Sem markdown ou texto fora do JSON. Valores em português, curtos, diretos e sem motivação vazia.`
  const content = await requestCopy({
    model: params.model,
    prompt: `Crie a copy para: ${params.prompt}`,
    systemPrompt,
    maxTokens: 400,
    options: { signal: params.signal, idempotencyKey: params.idempotencyKey },
  })
  const parsed: unknown = JSON.parse(content.replace(/```json|```/g, '').trim())
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('A IA retornou copy em formato inválido.')
  }
  return parsed as Record<string, string>
}

export async function generateValidatedCopy(params: {
  model: AIModel
  prompt: string
  career: 'fiscal' | 'policial' | 'tribunal' | 'geral'
  templateId: string
  availableFields: string[]
  signal?: AbortSignal
  idempotencyKey?: string
}): Promise<Record<string, string>> {
  const raw = await generateCopy(params)
  const { validData, errors } = validateCopyResponse(params.templateId, raw, params.availableFields)
  if (errors.length) throw new Error(`Copy inválida: ${errors.join('; ')}`)
  return validData
}

export interface CarouselCopySlideRequest {
  templateId: string
  availableFields: string[]
}

export async function generateCarouselCopy(params: {
  model: AIModel
  career: 'fiscal' | 'policial' | 'tribunal' | 'geral'
  markdown: string
  slides: CarouselCopySlideRequest[]
  signal?: AbortSignal
  idempotencyKey?: string
}): Promise<Record<string, string>[]> {
  if (!params.slides.length) throw new Error('Adicione modelos ao carrossel antes de gerar a copy.')
  const slideSpec = params.slides.map(
    (slide, index) => `Slide ${index + 1} (${slide.templateId}): ${slide.availableFields.join(', ')}`,
  ).join('\n')
  const content = await requestCopy({
    model: params.model,
    prompt: `Markdown de origem:\n\n${params.markdown}`,
    systemPrompt: `Você é um copywriter tático para ${careerDescription(params.career)}.
Retorne somente um array JSON com exatamente ${params.slides.length} objetos, na ordem indicada.
Cada objeto pode conter somente os campos de seu slide:\n${slideSpec}`,
    maxTokens: 1600,
    options: { signal: params.signal, idempotencyKey: params.idempotencyKey },
  })
  const parsed: unknown = JSON.parse(content.replace(/```json|```/g, '').trim())
  if (!Array.isArray(parsed) || parsed.length !== params.slides.length) {
    throw new Error('A IA não retornou uma copy para cada card do carrossel.')
  }
  return parsed.map((slide, index) => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) throw new Error(`Card ${index + 1} inválido.`)
    const { validData, errors } = validateCopyResponse(
      params.slides[index]!.templateId,
      slide,
      params.slides[index]!.availableFields,
    )
    if (errors.length) throw new Error(`Card ${index + 1} inválido: ${errors.join('; ')}`)
    return validData
  })
}

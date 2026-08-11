import type { AIModel } from '@/stores/useAIStore'

async function requestCopyModel(
  model: AIModel,
  apiKey: string,
  systemPrompt: string,
  userMsg: string,
  maxTokens: number,
): Promise<string> {
  if (model.provider === 'claude') {
    const resp = await fetch(model.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: `${systemPrompt}\n\n${userMsg}` }],
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err?.error?.message || `HTTP ${resp.status}`)
    }
    const data = await resp.json()
    return data.content?.[0]?.text || ''
  }

  const resp = await fetch(model.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${resp.status}`)
  }
  const data = await resp.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Espelha generateCopy() do Gerador/index.html original (linha 4168) — mesmo
 * system prompt (tom tático da marca), mesmo mapeamento de campos disponíveis no
 * template ativo, mesmo parsing de JSON com limpeza de fences markdown.
 */
export async function generateCopy(params: {
  model: AIModel
  apiKey: string
  prompt: string
  career: 'fiscal' | 'policial' | 'tribunal' | 'geral'
  availableFields: string[]
}): Promise<Record<string, string>> {
  const { model, apiKey, prompt, career, availableFields } = params

  const careerDesc =
    career === 'fiscal'
      ? 'carreiras fiscais (SEFAZ, Receita Federal, Auditor)'
      : career === 'policial'
        ? 'carreiras policiais (PF, PRF, PC, PCDF)'
        : career === 'tribunal'
          ? 'tribunais (TRF, TCU, TCE, STJ)'
          : 'concursos públicos em geral'

  const systemPrompt = `Você é um copywriter tático da Rota de Ataque, plataforma de estudos para concursos públicos.
Tom da marca: direto, militar, sem rodeios. Verbos no imperativo. Nunca motivacional vazio.
Público: candidatos a ${careerDesc}.
Retorne APENAS um objeto JSON válido com as chaves: ${availableFields.map((f) => `"${f}"`).join(', ')}.
Sem markdown, sem texto fora do JSON. Valores em português. Textos curtos e impactantes.
Eyebrow/tag: 1-3 palavras em maiúsculas. Título: 4-8 palavras em maiúsculas. Body/subtitle: 1-2 frases diretas.`

  const userMsg = `Crie o copy para: ${prompt}. Adapte para o template com os campos: ${availableFields.join(', ')}.`

  const rawContent = await requestCopyModel(model, apiKey, systemPrompt, userMsg, 400)

  const clean = rawContent.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)
  return parsed
}

export interface CarouselCopySlideRequest {
  templateId: string
  availableFields: string[]
}

/** Ajusta o conteúdo de um Markdown aos campos de cada slide de um carrossel. */
export async function generateCarouselCopy(params: {
  model: AIModel
  apiKey: string
  career: 'fiscal' | 'policial' | 'tribunal' | 'geral'
  markdown: string
  slides: CarouselCopySlideRequest[]
}): Promise<Record<string, string>[]> {
  const { model, apiKey, career, markdown, slides } = params
  if (slides.length === 0) throw new Error('Adicione modelos ao carrossel antes de importar o Markdown.')

  const careerDesc =
    career === 'fiscal'
      ? 'carreiras fiscais (SEFAZ, Receita Federal, Auditor)'
      : career === 'policial'
        ? 'carreiras policiais (PF, PRF, PC, PCDF)'
        : career === 'tribunal'
          ? 'tribunais (TRF, TCU, TCE, STJ)'
          : 'concursos públicos em geral'
  const slideSpec = slides
    .map((slide, index) => `Slide ${index + 1} (${slide.templateId}): ${slide.availableFields.join(', ') || 'sem campos de texto'}`)
    .join('\n')
  const systemPrompt = `Você é um copywriter tático da Rota de Ataque para ${careerDesc}.
Use o Markdown fornecido como fonte de verdade e distribua sua narrativa entre os slides.
Retorne APENAS um array JSON válido, com exatamente ${slides.length} objetos, na mesma ordem dos slides.
Cada objeto pode conter somente as chaves indicadas para seu respectivo slide. Não crie campos, não inclua markdown, não escreva texto fora do JSON.
Tom: direto, tático, sem motivação vazia. Respeite o espaço visual: eyebrow curto, título com impacto e texto objetivo.
\nCampos permitidos:\n${slideSpec}`
  const userMsg = `Markdown de origem:\n\n${markdown}`
  const rawContent = await requestCopyModel(model, apiKey, systemPrompt, userMsg, 1600)
  const parsed: unknown = JSON.parse(rawContent.replace(/```json|```/g, '').trim())

  if (!Array.isArray(parsed) || parsed.length !== slides.length) {
    throw new Error('A IA não retornou uma copy para cada card do carrossel.')
  }

  return parsed.map((slide, index) => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
      throw new Error(`A copy do card ${index + 1} está em formato inválido.`)
    }
    const allowedFields = new Set(slides[index]!.availableFields)
    return Object.fromEntries(
      Object.entries(slide).filter(
        ([field, value]) => allowedFields.has(field) && typeof value === 'string',
      ),
    ) as Record<string, string>
  })
}

import {
  COPY_MATRIX_V1,
  COPY_MATRIX_VERSION,
  defaultPriorityFor,
  normalizeHashtag,
  slotDecisionRawSchema,
  type SlotBrief,
  type SlotDecision,
} from '@plataforma/shared'
import { chatSlotCompletion, loadSlotLlmConfig, type SlotLlmConfig } from './slot-llm.js'

export interface SlotJobDeps {
  config?: SlotLlmConfig | null
  chat?: typeof chatSlotCompletion
  now?: () => Date
  signal?: AbortSignal
}

export interface SlotJobResult {
  ok: boolean
  decision?: SlotDecision
  provider?: 'primary' | 'fallback'
  error?: string
}

function schedulingFor(reviewMode: SlotDecision['reviewMode'], now: Date): string {
  const at = new Date(now)
  if (reviewMode === 'imediato') at.setHours(at.getHours() + 2)
  else if (reviewMode === 'fila') at.setHours(at.getHours() + 24)
  else at.setHours(at.getHours() + 48)
  return at.toISOString()
}

export function buildSlotPrompt(brief: SlotBrief): Array<{ role: 'system' | 'user'; content: string }> {
  const matrix = JSON.stringify(COPY_MATRIX_V1)
  return [
    {
      role: 'system',
      content: [
        'Você é o compositor de slots editoriais da Rota de Ataque.',
        'Responda EXCLUSIVAMENTE com um objeto JSON válido com EXATAMENTE estas chaves: contentType, postType, templateIds, slides, caption, hashtags, cta, rationale.',
        'Valores permitidos (use APENAS estes, sem variação):',
        '- contentType: noticia | prova_social | feature | educativo',
        '- postType: estatico | carrossel | story',
        '- slides[].role: cover | content | cta',
        '- templateIds: SqCover (estatico); CrCover, CrSlide, CrFact, CrList, CrCta (carrossel); PtCover, PtContent, PtCta (story)',
        '- hashtags: array de strings curtas SEM # (ex: ["pmmg", "concursos"]); o sistema adiciona # e normaliza.',
        'Limites: slides 1-10; title até 180 caracteres; body até 900; caption até 2200.',
        'Regras inegociáveis: nunca use o caractere de travessão (—); use vírgula ou dois-pontos.',
        'A legenda fecha sempre com o CTA da BIO presente na matriz.',
        'MATRIZ:',
        matrix,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        findingId: brief.findingId,
        title: brief.title,
        summary: brief.summary,
        content: (brief.content ?? '').slice(0, 3000),
        source: brief.sourceName,
        categoria: brief.categoria,
        estado: brief.estado,
        scores: {
          relevance: brief.relevanceScore,
          confidence: brief.confidence,
          factuality: brief.factualityScore,
          jevPreserved: brief.jevPreserved,
        },
        channel: brief.channel,
      }),
    },
  ]
}

const CONTENT_TYPE_ALIASES: Record<string, SlotDecision['contentType']> = {
  noticia: 'noticia',
  news: 'noticia',
  concurso: 'noticia',
  edital: 'noticia',
  atualizacao: 'noticia',
  prova_social: 'prova_social',
  depoimento: 'prova_social',
  feature: 'feature',
  plataforma: 'feature',
  recurso: 'feature',
  educativo: 'educativo',
  dica: 'educativo',
  dicas: 'educativo',
  estudo: 'educativo',
}

const POST_TYPE_ALIASES: Record<string, SlotDecision['postType']> = {
  estatico: 'estatico',
  estatico_unico: 'estatico',
  static: 'estatico',
  post_unico: 'estatico',
  carrossel: 'carrossel',
  carousel: 'carrossel',
  feed_carousel: 'carrossel',
  feed: 'carrossel',
  sequencia: 'carrossel',
  story: 'story',
  stories: 'story',
}

const SLIDE_ROLE_ALIASES: Record<string, 'cover' | 'content' | 'cta'> = {
  cover: 'cover',
  capa: 'cover',
  content: 'content',
  contexto: 'content',
  detalhe: 'content',
  destaques: 'content',
  requisitos: 'content',
  etapas: 'content',
  preparacao: 'content',
  exemplo: 'content',
  cta: 'cta',
  fechamento: 'cta',
}

const TEMPLATES_BY_POST_TYPE: Record<SlotDecision['postType'], string[]> = {
  estatico: ['SqCover'],
  carrossel: ['CrCover', 'CrSlide', 'CrCta'],
  story: ['PtCover', 'PtCta'],
}

function aliasOf<T extends string>(value: unknown, aliases: Record<string, T>): T | null {
  if (typeof value !== 'string') return null
  const key = value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
  return aliases[key] ?? null
}

function clipped(text: unknown, max: number): string {
  const str = typeof text === 'string' ? text : ''
  return str.slice(0, max)
}

/** Lenient parse: alias-maps model inventions, truncates overlong text, defaults templates. */
function normalizeRawDecision(raw: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; issues: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: 'not-an-object' }
  }
  const input = raw as Record<string, unknown>
  const contentType = aliasOf(input.contentType, CONTENT_TYPE_ALIASES)
  const postType = aliasOf(input.postType, POST_TYPE_ALIASES)
  if (!contentType || !postType) {
    return { ok: false, issues: `bad-enums contentType=${String(input.contentType)} postType=${String(input.postType)}` }
  }
  const rawSlides = Array.isArray(input.slides) ? input.slides.slice(0, 10) : []
  const slides = rawSlides.map((slide) => {
    const entry = (typeof slide === 'object' && slide !== null ? slide : {}) as Record<string, unknown>
    return {
      role: aliasOf(entry.role, SLIDE_ROLE_ALIASES) ?? 'content',
      title: clipped(entry.title, 180),
      body: clipped(entry.body, 900),
    }
  })
  const validTemplates = new Set(Object.values(TEMPLATES_BY_POST_TYPE).flat())
  const templateIds = Array.isArray(input.templateIds)
    ? input.templateIds.filter((id): id is string => typeof id === 'string' && validTemplates.has(id)).slice(0, 10)
    : []
  return {
    ok: true,
    value: {
      contentType,
      postType,
      templateIds: templateIds.length ? templateIds : TEMPLATES_BY_POST_TYPE[postType],
      slides,
      caption: clipped(input.caption, 2200),
      hashtags: Array.isArray(input.hashtags) ? input.hashtags.filter((tag) => typeof tag === 'string').slice(0, 15) : [],
      cta: clipped(input.cta, 300),
      rationale: clipped(input.rationale, 1000),
    },
  }
}

function safeJsonParse(content: string | undefined): unknown {
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function composeSlotDecision(
  brief: SlotBrief,
  deps: SlotJobDeps = {},
): Promise<SlotJobResult> {
  const config = deps.config ?? loadSlotLlmConfig() ?? null
  if (!config) return { ok: false, error: 'slot_llm_unconfigured' }
  const chat = deps.chat ?? chatSlotCompletion
  const now = (deps.now ?? (() => new Date()))()
  try {
    const messages = buildSlotPrompt(brief)
    const attempts: Array<{ content: string; provider: 'primary' | 'fallback' }> = [await chat(config, messages, deps.signal)]
    let normalized = normalizeRawDecision(safeJsonParse(attempts[0]?.content))
    if (!normalized.ok) {
      messages.push({
        role: 'user',
        content: `Sua resposta anterior foi inválida (${normalized.issues}). Responda novamente com APENAS o JSON nas chaves e valores permitidos, sem texto extra.`,
      })
      attempts.push(await chat(config, messages, deps.signal))
      normalized = normalizeRawDecision(safeJsonParse(attempts[attempts.length - 1]?.content))
    }
    if (!normalized.ok) {
      console.warn(JSON.stringify({ event: 'slot.decision_invalid', issues: normalized.issues }))
      return { ok: false, error: 'slot_decision_invalid' }
    }
    const parsed = slotDecisionRawSchema.safeParse(normalized.value)
    if (!parsed.success) {
      console.warn(JSON.stringify({ event: 'slot.decision_invalid', issues: 'schema-reject' }))
      return { ok: false, error: 'slot_decision_invalid' }
    }
    const { priority, reviewMode } = defaultPriorityFor({
      jevPreserved: brief.jevPreserved,
      contentType: parsed.data.contentType,
    })
    const hashtags = parsed.data.hashtags
      .map((tag) => normalizeHashtag(tag))
      .filter((tag): tag is string => tag !== null)
      .slice(0, 15)
    const decision: SlotDecision = {
      ...parsed.data,
      hashtags,
      findingId: brief.findingId,
      priority,
      reviewMode,
      scheduledFor: schedulingFor(reviewMode, now),
      matrixVersion: COPY_MATRIX_VERSION,
    }
    return { ok: true, decision, provider: attempts[attempts.length - 1]?.provider ?? 'primary' }
  } catch {
    return { ok: false, error: 'slot_llm_failed' }
  }
}

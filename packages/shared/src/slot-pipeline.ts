/**
 * slot-pipeline.ts
 * Contratos do pipeline automático de slots editoriais (Fase 0 do plano
 * de automação slots → LLM → auditoria → fila → publicação).
 * Sem comportamento: apenas tipos + schemas zod compartilhados.
 */
import { z } from 'zod'

export const slotContentTypeEnum = z.enum(['noticia', 'prova_social', 'feature', 'educativo'])
export const slotPostTypeEnum = z.enum(['estatico', 'carrossel', 'story'])
export const slotChannelEnum = z.enum(['instagram', 'threads'])
export const slotPriorityEnum = z.enum(['P0', 'P1', 'P2', 'P3'])
export const slotReviewModeEnum = z.enum(['imediato', 'fila', 'rigoroso'])

export const slotBriefSchema = z.object({
  findingId: z.string().uuid(),
  title: z.string().min(1).max(500),
  summary: z.string().max(4000).nullish(),
  content: z.string().max(20000).nullish(),
  sourceUrl: z.string().url().nullish(),
  sourceName: z.string().max(200).nullish(),
  categoria: z.string().min(1).max(60),
  estado: z.string().max(2).nullish(),
  relevanceScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  factualityScore: z.number().min(0).max(1),
  jevPreserved: z.number().min(0).max(1).nullish(),
  channel: slotChannelEnum.default('instagram'),
  scheduledFor: z.string().datetime().nullish(),
})

export const slotSlideSchema = z.object({
  role: z.enum(['cover', 'content', 'cta']),
  title: z.string().min(1).max(180),
  body: z.string().max(900),
})

export const slotDecisionSchema = z.object({
  findingId: z.string().uuid(),
  contentType: slotContentTypeEnum,
  postType: slotPostTypeEnum,
  templateIds: z.array(z.string().min(1).max(100)).min(1).max(10),
  slides: z.array(slotSlideSchema).min(1).max(10),
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string().min(2).max(60).regex(/^#[\p{L}\p{N}_]+$/u)).max(15),
  cta: z.string().min(1).max(300),
  scheduledFor: z.string().datetime(),
  priority: slotPriorityEnum,
  reviewMode: slotReviewModeEnum,
  rationale: z.string().min(1).max(1000),
  matrixVersion: z.string().default('copy-matrix.v1'),
})

export type SlotBrief = z.infer<typeof slotBriefSchema>
export type SlotDecision = z.infer<typeof slotDecisionSchema>
export type SlotContentType = z.infer<typeof slotContentTypeEnum>
export type SlotPostType = z.infer<typeof slotPostTypeEnum>
export type SlotPriority = z.infer<typeof slotPriorityEnum>
export type SlotReviewMode = z.infer<typeof slotReviewModeEnum>

/**
 * Raw LLM output: system-owned fields are optional because the pipeline
 * always recomputes them (finding linkage, priority, review mode, schedule).
 */
export const slotDecisionRawSchema = z.object({
  contentType: slotContentTypeEnum,
  postType: slotPostTypeEnum,
  templateIds: z.array(z.string().min(1).max(100)).min(1).max(10),
  slides: z.array(slotSlideSchema).min(1).max(10),
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string().min(1).max(60)).max(15),
  cta: z.string().min(1).max(300),
  rationale: z.string().min(1).max(1000),
})

export type SlotDecisionRaw = z.infer<typeof slotDecisionRawSchema>

/** Normalizes model-written hashtags to #lowercase-unaccented form. */
export function normalizeHashtag(tag: string): string | null {
  const cleaned = tag
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/gu, '')
  if (cleaned.length < 2) return null
  return `#${cleaned}`
}

/** Prioridade padrão por portão de confiança (documentada no plano). */
export function defaultPriorityFor(input: {
  jevPreserved: number | null | undefined
  contentType: SlotContentType
}): { priority: SlotPriority; reviewMode: SlotReviewMode } {
  if (input.contentType === 'noticia' && (input.jevPreserved ?? 0) >= 0.8) {
    return { priority: 'P0', reviewMode: 'imediato' }
  }
  if (input.contentType === 'noticia') {
    return { priority: 'P1', reviewMode: 'fila' }
  }
  if (input.contentType === 'feature') {
    return { priority: 'P2', reviewMode: 'fila' }
  }
  return { priority: 'P3', reviewMode: 'rigoroso' }
}

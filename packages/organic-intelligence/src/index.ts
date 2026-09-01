import { createHash } from 'node:crypto'
import { z } from 'zod'

export const platformSchema = z.enum(['web', 'instagram', 'threads', 'tiktok', 'youtube', 'reddit', 'x', 'google', 'news', 'forum', 'blog'])
export const providerSchema = z.enum(['news_radar', 'manual'])
export const observationSchema = z.object({
  provider: providerSchema,
  platform: platformSchema,
  externalId: z.string().min(1),
  canonicalUrl: z.string().url(),
  authorExternalId: z.string().optional(),
  observedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  context: z.record(z.string(), z.string().nullable()).optional(),
  metrics: z.record(z.string(), z.number().nullable()).default({}),
  rawSchemaVersion: z.string().min(1),
})
export type ProviderObservation = z.infer<typeof observationSchema>

export function logicalEntityKey(observation: ProviderObservation): string {
  const parsed = observationSchema.parse(observation)
  const normalized = parsed.canonicalUrl.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '')
  return createHash('sha256').update(`${parsed.platform}\u001f${normalized}`).digest('hex')
}

export interface BudgetState { limitUsd: number; reservedUsd: number; spentUsd: number }
export function reserveBudget(state: BudgetState, estimatedUsd: number): BudgetState {
  if (!Number.isFinite(estimatedUsd) || estimatedUsd < 0) throw new Error('INVALID_ESTIMATE')
  if (state.spentUsd + state.reservedUsd + estimatedUsd > state.limitUsd) throw new Error('BUDGET_BLOCKED')
  return { ...state, reservedUsd: state.reservedUsd + estimatedUsd }
}
export function reconcileBudget(state: BudgetState, estimatedUsd: number, actualUsd: number): BudgetState {
  if (actualUsd < 0 || estimatedUsd < 0) throw new Error('INVALID_COST')
  return { ...state, reservedUsd: Math.max(0, state.reservedUsd - estimatedUsd), spentUsd: state.spentUsd + actualUsd }
}

export function robustOutlier(values: number[], value: number): { score: number; confidence: number } {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (finite.length < 5) return { score: 0, confidence: finite.length / 5 }
  const median = percentile(finite, .5)
  const deviations = finite.map((item) => Math.abs(item - median)).sort((a, b) => a - b)
  const mad = percentile(deviations, .5)
  if (mad === 0) return { score: value === median ? 0 : Math.sign(value - median) * 3, confidence: 1 }
  return { score: .6745 * (value - median) / mad, confidence: Math.min(1, finite.length / 20) }
}
function percentile(values: number[], p: number): number {
  const index = (values.length - 1) * p
  const lower = Math.floor(index), upper = Math.ceil(index)
  return values[lower]! + (values[upper]! - values[lower]!) * (index - lower)
}

export interface OpportunityComponents {
  relativePerformance: number; recurrence: number; growth: number; audiencePain: number;
  utility: number; audienceFit: number; freshness: number; saturation: number;
  confidence: number; historicalFit: number; marginalCostPenalty: number
}
export function opportunityScore(components: OpportunityComponents): { total: number; components: OpportunityComponents; version: string } {
  const positive = components.relativePerformance * .18 + components.recurrence * .13 + components.growth * .1 + components.audiencePain * .13 + components.utility * .1 + components.audienceFit * .12 + components.freshness * .07 + components.historicalFit * .07
  const penalty = components.saturation * .06 + components.marginalCostPenalty * .04
  return { total: Math.max(0, Math.min(100, (positive - penalty) * components.confidence * 100)), components, version: 'organic-opportunity-v1' }
}

export const creativeBridgePayloadSchema = z.object({
  schema_version: z.literal('1.0'), content_item_id: z.string().uuid(), variant_id: z.string().uuid(),
  opportunity_id: z.string().uuid().nullable(), campaign_id: z.string().uuid(), thesis: z.string(),
  topic: z.string(), hook: z.string(), copy: z.string(), cta: z.string().nullable(),
  format: z.string(), slide_structure: z.array(z.record(z.string(), z.unknown())).max(20),
  media_requirements: z.record(z.string(), z.unknown()), template_recommendation: z.string().nullable(),
  source_references: z.array(z.object({ label: z.string(), url: z.string().url() })).max(20),
  correlation_id: z.string().uuid(),
}).strict()

export const editorialClassificationSchema = z.object({
  topic: z.string().min(1), subtopic: z.string().nullable(), pain: z.string().nullable(), desire: z.string().nullable(),
  question: z.string().nullable(), objection: z.string().nullable(), thesis: z.string().min(1), promise: z.string().nullable(),
  hook: z.string().min(1), cta: z.string().nullable(), format: z.string().min(1), structure: z.array(z.string()).max(30),
  sentiment: z.enum(['negative', 'neutral', 'positive', 'mixed']), audience_stage: z.enum(['awareness', 'consideration', 'decision', 'retention']),
  utility: z.number().min(0).max(1), save_potential: z.number().min(0).max(1), share_potential: z.number().min(0).max(1),
  comment_potential: z.number().min(0).max(1), growth_potential: z.number().min(0).max(1), reach_potential: z.number().min(0).max(1),
  like_potential: z.number().min(0).max(1), evergreen: z.number().min(0).max(1), trend: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1), evidence_ids: z.array(z.string().uuid()).min(1), model_version: z.string().min(1),
}).strict()

export function decideFallback(input: { primarySupported: boolean; primaryError?: 'unavailable' | 'rate_limited' | 'incomplete' | 'invalid_credentials' | 'validation' | 'budget_blocked' | 'forbidden'; validationSample?: boolean }) {
  if (input.validationSample) return 'validation_sample' as const
  if (!input.primarySupported) return 'primary_not_supported' as const
  if (input.primaryError === 'unavailable' || input.primaryError === 'rate_limited') return 'primary_failed' as const
  if (input.primaryError === 'incomplete') return 'primary_incomplete' as const
  return null
}

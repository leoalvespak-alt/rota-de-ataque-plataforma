import type {
  contentBriefs, contentItems, editorialCampaigns, editorialPlanItems, editorialPlans, editorialTheses,
  knowledgeChunks, knowledgeDocuments, promptTemplates,
} from '@/db/editorial-schema'

export const THESIS_STATUSES = ['draft', 'active', 'archived'] as const
export const CONTENT_FORMATS = ['post', 'carousel', 'story', 'slide', 'document'] as const
export const CONTENT_STATUSES = ['draft', 'generating', 'reviewing', 'needs_revision', 'ready_for_approval', 'approved', 'rejected', 'scheduled', 'published', 'archived', 'failed'] as const
export const PLAN_ITEM_STATUSES = ['planned', 'brief_generated', 'content_generated', 'reviewing', 'approved', 'rejected', 'published'] as const
export const KNOWLEDGE_TYPES = ['text', 'markdown', 'pdf', 'transcript', 'faq', 'note', 'research'] as const
export const REVIEW_REASONS = ['repetitive', 'superficial', 'off_thesis', 'wrong_tone', 'factual', 'visual', 'cta', 'title', 'format', 'other'] as const

export type Thesis = typeof editorialTheses.$inferSelect
export type NewThesis = typeof editorialTheses.$inferInsert
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect
export type Campaign = typeof editorialCampaigns.$inferSelect
export type Plan = typeof editorialPlans.$inferSelect
export type PlanItem = typeof editorialPlanItems.$inferSelect
export type ContentBrief = typeof contentBriefs.$inferSelect
export type ContentItem = typeof contentItems.$inferSelect
export type PromptTemplate = typeof promptTemplates.$inferSelect
export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export interface QualityScore {
  thesisAlignment: number; novelty: number; clarity: number; specificity: number; hookStrength: number
  formatFit: number; voiceConsistency: number; factualGrounding: number; repetitionRisk: number; overall: number
}

export interface SimilarityResult { semantic: number; lexical: number; ngram: number; title: number; hook: number; decision: 'pass' | 'review' | 'block' }

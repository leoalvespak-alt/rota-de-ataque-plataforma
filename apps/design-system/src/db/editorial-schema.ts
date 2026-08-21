import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { vector } from './pgvector'

const editorialDates = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}

export const editorialTheses = pgTable('editorial_theses', {
  id: uuid('id').primaryKey().defaultRandom(), title: varchar('title', { length: 500 }).notNull(), slug: varchar('slug', { length: 255 }).notNull(),
  summary: text('summary'), coreStatement: text('core_statement').notNull(), fullText: text('full_text'), status: varchar('status', { length: 20 }).default('draft').notNull(),
  priority: integer('priority').default(0).notNull(), weight: numeric('weight', { precision: 8, scale: 2 }).default('1').notNull(), tone: varchar('tone', { length: 100 }), depthLevel: varchar('depth_level', { length: 100 }), audienceStage: varchar('audience_stage', { length: 100 }),
  allowedCta: text('allowed_cta').array().default([]), recommendedFormats: text('recommended_formats').array().default([]), vocabulary: text('vocabulary').array().default([]), forbiddenWords: text('forbidden_words').array().default([]), beliefsToReinforce: text('beliefs_to_reinforce').array().default([]), beliefsToCombat: text('beliefs_to_combat').array().default([]), commonErrors: text('common_errors').array().default([]), tags: text('tags').array().default([]), version: integer('version').default(1).notNull(), ...editorialDates,
}, (table) => [uniqueIndex('editorial_theses_slug_idx').on(table.slug), index('editorial_theses_status_idx').on(table.status), index('editorial_theses_tags_idx').using('gin', table.tags)])

export const editorialThesisVersions = pgTable('editorial_thesis_versions', {
  id: uuid('id').primaryKey().defaultRandom(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), version: integer('version').notNull(), snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(), changedBy: varchar('changed_by', { length: 255 }), changeReason: text('change_reason'), createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const editorialThesisArguments = pgTable('editorial_thesis_arguments', {
  id: uuid('id').primaryKey().defaultRandom(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), type: varchar('type', { length: 20 }).notNull(), title: varchar('title', { length: 500 }).notNull(), content: text('content').notNull(), position: integer('position').default(0).notNull(), usageCount: integer('usage_count').default(0).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
})
export const editorialThesisObjections = pgTable('editorial_thesis_objections', {
  id: uuid('id').primaryKey().defaultRandom(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), objection: text('objection').notNull(), response: text('response').notNull(), frequency: varchar('frequency', { length: 10 }).default('medium').notNull(), position: integer('position').default(0).notNull(), usageCount: integer('usage_count').default(0).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
})
export const editorialThesisExamples = pgTable('editorial_thesis_examples', {
  id: uuid('id').primaryKey().defaultRandom(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), title: varchar('title', { length: 500 }).notNull(), content: text('content').notNull(), type: varchar('type', { length: 20 }).notNull(), position: integer('position').default(0).notNull(), usageCount: integer('usage_count').default(0).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
})
export const editorialThesisEvidence = pgTable('editorial_thesis_evidence', {
  id: uuid('id').primaryKey().defaultRandom(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), title: varchar('title', { length: 500 }).notNull(), content: text('content').notNull(), sourceUrl: text('source_url'), sourceName: varchar('source_name', { length: 500 }), position: integer('position').default(0).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
})
export const editorialThesisRelations = pgTable('editorial_thesis_relations', {
  id: uuid('id').primaryKey().defaultRandom(), thesisAId: uuid('thesis_a_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), thesisBId: uuid('thesis_b_id').references(() => editorialTheses.id, { onDelete: 'cascade' }).notNull(), relationType: varchar('relation_type', { length: 20 }).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(), title: varchar('title', { length: 500 }).notNull(), type: varchar('type', { length: 20 }).notNull(), originalFilename: varchar('original_filename', { length: 500 }), storageKey: varchar('storage_key', { length: 1000 }), contentText: text('content_text').notNull(), wordCount: integer('word_count').default(0).notNull(), language: varchar('language', { length: 20 }).default('pt-BR').notNull(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'set null' }), tags: text('tags').array().default([]), status: varchar('status', { length: 20 }).default('pending').notNull(), version: integer('version').default(1).notNull(), hash: varchar('hash', { length: 128 }).notNull(), ...editorialDates,
}, (table) => [index('knowledge_documents_hash_idx').on(table.hash), index('knowledge_documents_status_idx').on(table.status), index('knowledge_documents_tags_idx').using('gin', table.tags)])
export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: uuid('id').primaryKey().defaultRandom(), documentId: uuid('document_id').references(() => knowledgeDocuments.id, { onDelete: 'cascade' }).notNull(), chunkIndex: integer('chunk_index').notNull(), title: varchar('title', { length: 500 }), content: text('content').notNull(), normalizedContent: text('normalized_content').notNull(), chunkType: varchar('chunk_type', { length: 20 }).notNull(), sectionPath: text('section_path'), pageOrSection: varchar('page_or_section', { length: 100 }), tags: text('tags').array().default([]), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'set null' }), language: varchar('language', { length: 20 }).default('pt-BR').notNull(), hash: varchar('hash', { length: 128 }).notNull(), tokenCount: integer('token_count').notNull(), version: integer('version').default(1).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('knowledge_chunks_document_idx').on(table.documentId), uniqueIndex('knowledge_chunks_document_position_idx').on(table.documentId, table.chunkIndex)])
export const knowledgeEmbeddings = pgTable('knowledge_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(), chunkId: uuid('chunk_id').references(() => knowledgeChunks.id, { onDelete: 'cascade' }).notNull(), modelName: varchar('model_name', { length: 255 }).notNull(), modelVersion: varchar('model_version', { length: 255 }).notNull(), embedding: vector('embedding', 1536).notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('knowledge_embeddings_chunk_idx').on(table.chunkId)])

export const editorialIntents = pgTable('editorial_intents', { id: uuid('id').primaryKey().defaultRandom(), name: varchar('name', { length: 100 }).notNull(), label: varchar('label', { length: 255 }).notNull(), description: text('description'), position: integer('position').default(0).notNull(), active: boolean('active').default(true).notNull() }, (table) => [uniqueIndex('editorial_intents_name_idx').on(table.name)])
export const editorialAngles = pgTable('editorial_angles', { id: uuid('id').primaryKey().defaultRandom(), name: varchar('name', { length: 100 }).notNull(), label: varchar('label', { length: 255 }).notNull(), description: text('description'), position: integer('position').default(0).notNull(), active: boolean('active').default(true).notNull() }, (table) => [uniqueIndex('editorial_angles_name_idx').on(table.name)])
export const editorialHooks = pgTable('editorial_hooks', { id: uuid('id').primaryKey().defaultRandom(), pattern: text('pattern').notNull(), category: varchar('category', { length: 30 }).notNull(), usageCount: integer('usage_count').default(0).notNull(), lastUsedAt: timestamp('last_used_at'), active: boolean('active').default(true).notNull(), createdAt: timestamp('created_at').defaultNow().notNull() })
export const editorialDepthLevels = pgTable('editorial_depth_levels', { id: uuid('id').primaryKey().defaultRandom(), name: varchar('name', { length: 100 }).notNull(), label: varchar('label', { length: 255 }).notNull(), position: integer('position').default(0).notNull() }, (table) => [uniqueIndex('editorial_depth_levels_name_idx').on(table.name)])

export const editorialCampaigns = pgTable('editorial_campaigns', { id: uuid('id').primaryKey().defaultRandom(), title: varchar('title', { length: 500 }).notNull(), description: text('description'), startDate: date('start_date').notNull(), endDate: date('end_date').notNull(), status: varchar('status', { length: 20 }).default('draft').notNull(), preset: varchar('preset', { length: 100 }), config: jsonb('config').$type<Record<string, unknown>>().default({}), ...editorialDates })
export const editorialPlans = pgTable('editorial_plans', { id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').references(() => editorialCampaigns.id, { onDelete: 'cascade' }).notNull(), title: varchar('title', { length: 500 }).notNull(), periodStart: date('period_start').notNull(), periodEnd: date('period_end').notNull(), totalItems: integer('total_items').default(0).notNull(), config: jsonb('config').$type<Record<string, unknown>>().default({}), status: varchar('status', { length: 20 }).default('draft').notNull(), approvedAt: timestamp('approved_at'), approvedBy: varchar('approved_by', { length: 255 }), ...editorialDates }, (table) => [index('editorial_plans_campaign_status_idx').on(table.campaignId, table.status)])
export const editorialPlanItems = pgTable('editorial_plan_items', { id: uuid('id').primaryKey().defaultRandom(), planId: uuid('plan_id').references(() => editorialPlans.id, { onDelete: 'cascade' }).notNull(), position: integer('position').notNull(), scheduledDate: date('scheduled_date'), format: varchar('format', { length: 20 }).notNull(), thesisId: uuid('thesis_id').references(() => editorialTheses.id).notNull(), intentId: uuid('intent_id').references(() => editorialIntents.id, { onDelete: 'set null' }), angleId: uuid('angle_id').references(() => editorialAngles.id, { onDelete: 'set null' }), hookStrategy: varchar('hook_strategy', { length: 255 }), depthLevel: varchar('depth_level', { length: 100 }), audienceStage: varchar('audience_stage', { length: 100 }), cta: text('cta'), visualDirection: text('visual_direction'), coreArgumentId: uuid('core_argument_id').references(() => editorialThesisArguments.id, { onDelete: 'set null' }), templateSuggestion: varchar('template_suggestion', { length: 100 }), sequencePosition: integer('sequence_position'), status: varchar('status', { length: 30 }).default('planned').notNull(), ...editorialDates }, (table) => [index('editorial_plan_items_plan_idx').on(table.planId), index('editorial_plan_items_thesis_idx').on(table.thesisId)])

export const contentBriefs = pgTable('content_briefs', { id: uuid('id').primaryKey().defaultRandom(), planItemId: uuid('plan_item_id').references(() => editorialPlanItems.id, { onDelete: 'cascade' }).notNull(), thesisId: uuid('thesis_id').references(() => editorialTheses.id).notNull(), format: varchar('format', { length: 20 }).notNull(), intent: varchar('intent', { length: 100 }), angle: varchar('angle', { length: 100 }), audienceStage: varchar('audience_stage', { length: 100 }), hookStrategy: varchar('hook_strategy', { length: 255 }), coreArgument: text('core_argument').notNull(), supportingPoints: text('supporting_points').array().default([]), evidenceIds: uuid('evidence_ids').array().default([]), cta: text('cta'), visualDirection: text('visual_direction'), avoid: text('avoid').array().default([]), status: varchar('status', { length: 20 }).default('draft').notNull(), validationErrors: text('validation_errors').array(), thesisVersion: integer('thesis_version').notNull(), createdAt: timestamp('created_at').defaultNow().notNull() })
export const contentItems = pgTable('content_items', { id: uuid('id').primaryKey().defaultRandom(), planItemId: uuid('plan_item_id').references(() => editorialPlanItems.id, { onDelete: 'set null' }), briefId: uuid('brief_id').references(() => contentBriefs.id, { onDelete: 'set null' }), thesisId: uuid('thesis_id').references(() => editorialTheses.id).notNull(), format: varchar('format', { length: 20 }).notNull(), copyData: jsonb('copy_data').$type<Record<string, unknown>>().notNull(), status: varchar('status', { length: 30 }).default('draft').notNull(), templateId: varchar('template_id', { length: 100 }), renderId: uuid('render_id'), qualityScore: jsonb('quality_score').$type<Record<string, number>>(), similarityScore: numeric('similarity_score', { precision: 5, scale: 4 }), generationModel: varchar('generation_model', { length: 255 }), generationCost: numeric('generation_cost', { precision: 12, scale: 6 }), version: integer('version').default(1).notNull(), ...editorialDates }, (table) => [index('content_items_thesis_status_format_idx').on(table.thesisId, table.status, table.format)])
export const contentVersions = pgTable('content_versions', { id: uuid('id').primaryKey().defaultRandom(), contentItemId: uuid('content_item_id').references(() => contentItems.id, { onDelete: 'cascade' }).notNull(), version: integer('version').notNull(), copyData: jsonb('copy_data').$type<Record<string, unknown>>().notNull(), templateId: varchar('template_id', { length: 100 }), changeReason: text('change_reason'), createdAt: timestamp('created_at').defaultNow().notNull() })
export const contentReviews = pgTable('content_reviews', { id: uuid('id').primaryKey().defaultRandom(), contentItemId: uuid('content_item_id').references(() => contentItems.id, { onDelete: 'cascade' }).notNull(), reviewer: varchar('reviewer', { length: 255 }).notNull(), action: varchar('action', { length: 30 }).notNull(), reasonCode: varchar('reason_code', { length: 30 }), comment: text('comment'), createdAt: timestamp('created_at').defaultNow().notNull() })
export const contentSimilarityScores = pgTable('content_similarity_scores', { id: uuid('id').primaryKey().defaultRandom(), contentItemId: uuid('content_item_id').references(() => contentItems.id, { onDelete: 'cascade' }).notNull(), comparedToId: uuid('compared_to_id').references(() => contentItems.id, { onDelete: 'cascade' }).notNull(), semanticScore: numeric('semantic_score', { precision: 5, scale: 4 }).notNull(), lexicalScore: numeric('lexical_score', { precision: 5, scale: 4 }), ngramOverlap: numeric('ngram_overlap', { precision: 5, scale: 4 }), layer: varchar('layer', { length: 20 }).notNull(), createdAt: timestamp('created_at').defaultNow().notNull() })
export const contentUsageLedger = pgTable('content_usage_ledger', { id: uuid('id').primaryKey().defaultRandom(), contentItemId: uuid('content_item_id').references(() => contentItems.id, { onDelete: 'cascade' }).notNull(), thesisId: uuid('thesis_id').references(() => editorialTheses.id, { onDelete: 'set null' }), argumentId: uuid('argument_id').references(() => editorialThesisArguments.id, { onDelete: 'set null' }), objectionId: uuid('objection_id').references(() => editorialThesisObjections.id, { onDelete: 'set null' }), exampleId: uuid('example_id').references(() => editorialThesisExamples.id, { onDelete: 'set null' }), evidenceId: uuid('evidence_id').references(() => editorialThesisEvidence.id, { onDelete: 'set null' }), angleId: uuid('angle_id').references(() => editorialAngles.id, { onDelete: 'set null' }), hookId: uuid('hook_id').references(() => editorialHooks.id, { onDelete: 'set null' }), intentId: uuid('intent_id').references(() => editorialIntents.id, { onDelete: 'set null' }), templateUsed: varchar('template_used', { length: 100 }), ctaUsed: text('cta_used'), keywords: text('keywords').array().default([]), usedAt: date('used_at').notNull(), createdAt: timestamp('created_at').defaultNow().notNull() }, (table) => [index('content_usage_ledger_thesis_used_idx').on(table.thesisId, table.usedAt)])

export const generationJobs = pgTable('generation_jobs', { id: uuid('id').primaryKey().defaultRandom(), planId: uuid('plan_id').references(() => editorialPlans.id, { onDelete: 'set null' }), campaignId: uuid('campaign_id').references(() => editorialCampaigns.id, { onDelete: 'set null' }), type: varchar('type', { length: 50 }).notNull(), status: varchar('status', { length: 20 }).default('pending').notNull(), inputData: jsonb('input_data').$type<Record<string, unknown>>().notNull(), outputData: jsonb('output_data').$type<Record<string, unknown>>(), parentJobId: uuid('parent_job_id'), priority: integer('priority').default(0).notNull(), attempts: integer('attempts').default(0).notNull(), maxAttempts: integer('max_attempts').default(3).notNull(), error: text('error'), provider: varchar('provider', { length: 255 }), model: varchar('model', { length: 255 }), inputTokens: integer('input_tokens'), outputTokens: integer('output_tokens'), cost: numeric('cost', { precision: 12, scale: 6 }), durationMs: integer('duration_ms'), bullmqJobId: varchar('bullmq_job_id', { length: 255 }), createdAt: timestamp('created_at').defaultNow().notNull(), startedAt: timestamp('started_at'), completedAt: timestamp('completed_at') }, (table) => [index('generation_jobs_status_type_idx').on(table.status, table.type)])
export const promptTemplates = pgTable('prompt_templates', { id: uuid('id').primaryKey().defaultRandom(), name: varchar('name', { length: 255 }).notNull(), type: varchar('type', { length: 100 }).notNull(), template: text('template').notNull(), variables: text('variables').array().default([]), outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(), version: integer('version').default(1).notNull(), active: boolean('active').default(true).notNull(), ...editorialDates }, (table) => [uniqueIndex('prompt_templates_name_idx').on(table.name)])
export const promptVersions = pgTable('prompt_versions', { id: uuid('id').primaryKey().defaultRandom(), promptTemplateId: uuid('prompt_template_id').references(() => promptTemplates.id, { onDelete: 'cascade' }).notNull(), version: integer('version').notNull(), template: text('template').notNull(), variables: text('variables').array().default([]), outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(), createdAt: timestamp('created_at').defaultNow().notNull() })

// ── Tabela unificada de criativos (migration 0032) ────────────────────────────
// Referências externas (tabela `theses` do Prospector) são tratadas como texto/uuid
// sem FK em nível Drizzle para evitar dependência cruzada de schema.
export const unifiedCreatives = pgTable('unified_creatives', {
  id:               uuid('id').primaryKey().defaultRandom(),

  // FKs — Design System side
  edThesisId:       uuid('ed_thesis_id').references(() => editorialTheses.id, { onDelete: 'set null' }),
  planItemId:       uuid('plan_item_id').references(() => editorialPlanItems.id, { onDelete: 'set null' }),
  contentItemId:    uuid('content_item_id').references(() => contentItems.id, { onDelete: 'set null' }),

  // FK — Prospector side (sem FK Drizzle: tabela `theses` não está neste schema)
  thesisId:         uuid('thesis_id'),

  // Campos canônicos
  title:            text('title'),
  caption:          text('caption'),
  channel:          varchar('channel', { length: 50 }),
  format:           varchar('format', { length: 50 }),
  status:           varchar('status', { length: 30 }).default('draft').notNull(),
  curationStatus:   varchar('curation_status', { length: 30 }),
  scheduledFor:     timestamp('scheduled_for', { withTimezone: true }),
  publishedAt:      timestamp('published_at', { withTimezone: true }),
  approvedBy:       text('approved_by'),

  // Proveniência
  origin:           varchar('origin', { length: 50 }),
  batchId:          uuid('batch_id'),

  // Conteúdo gerado
  copyData:         jsonb('copy_data').$type<Record<string, unknown>>().default({}),
  visualDirection:  text('visual_direction'),
  templateId:       varchar('template_id', { length: 100 }),
  renderId:         uuid('render_id'),
  qualityScore:     jsonb('quality_score').$type<Record<string, number>>(),

  // Estratégia editorial
  hookStrategy:     text('hook_strategy'),
  depthLevel:       varchar('depth_level', { length: 100 }),
  audienceStage:    varchar('audience_stage', { length: 100 }),
  cta:              text('cta'),
  sequencePosition: integer('sequence_position'),

  ...editorialDates,
}, (table) => [
  index('unified_creatives_status_idx').on(table.status),
  index('unified_creatives_thesis_idx').on(table.thesisId),
  index('unified_creatives_ed_thesis_idx').on(table.edThesisId),
  index('unified_creatives_batch_idx').on(table.batchId),
])


/**
 * creative-job-schema.ts
 * Zod schemas for Creative Bridge jobs (design, copy, video briefs)
 * Used both server-side (API validation) and client-side (form validation)
 */
import { z } from 'zod'

// Core channel types
export const channelEnum = z.enum(['instagram', 'threads', 'email', 'whatsapp_dm', 'whatsapp_group'])

// Job types
export const creativeJobTypeEnum = z.enum(['design', 'copy', 'video_script', 'carousel', 'story'])

// Priority types
export const priorityEnum = z.enum(['P0', 'P1', 'P2', 'P3'])

// Status types for a creative job
export const creativeJobStatusEnum = z.enum([
  'draft',
  'pending_assignment',
  'in_progress',
  'review',
  'approved',
  'rejected',
  'done',
])

/** Brief schema for a design job */
export const designBriefSchema = z.object({
  headline: z.string().min(5, 'Título deve ter pelo menos 5 caracteres.').max(120),
  subheadline: z.string().max(240).optional(),
  color_palette: z.array(z.string()).max(5).optional(),
  reference_urls: z.array(z.string().url('URL de referência inválida.')).max(5).optional(),
  dimensions: z.object({
    width: z.number().min(100),
    height: z.number().min(100),
  }).optional(),
  notes: z.string().max(2000).optional(),
})

/** Brief schema for a copy/text job */
export const copyBriefSchema = z.object({
  goal: z.string().min(10, 'Objetivo deve ter pelo menos 10 caracteres.'),
  audience: z.string().min(5),
  tone: z.enum(['formal', 'casual', 'inspirational', 'urgent', 'educational']),
  max_characters: z.number().min(10).max(10000).optional(),
  cta: z.string().max(80).optional(),
  keywords: z.array(z.string()).max(20).optional(),
  notes: z.string().max(2000).optional(),
})

/** Full creative job schema for creation */
export const createCreativeJobSchema = z.object({
  content_opportunity_id: z.string().uuid('ID da oportunidade inválido.').optional(),
  content_item_id: z.string().uuid('ID do item de conteúdo inválido.').optional(),
  channel: channelEnum,
  job_type: creativeJobTypeEnum,
  priority: priorityEnum.default('P2'),
  assigned_to: z.string().uuid().optional(),
  due_date: z.string().datetime({ message: 'Data de prazo inválida.' }).optional(),
  brief: z.union([designBriefSchema, copyBriefSchema]),
  notes: z.string().max(5000).optional(),
}).refine(
  (data) => data.content_opportunity_id || data.content_item_id,
  { message: 'O job deve estar vinculado a uma oportunidade ou item de conteúdo.' }
)

/** Schema for updating a creative job status */
export const updateCreativeJobSchema = z.object({
  id: z.string().uuid(),
  status: creativeJobStatusEnum,
  feedback: z.string().max(2000).optional(),
})

// Type exports
export type DesignBrief = z.infer<typeof designBriefSchema>
export type CopyBrief = z.infer<typeof copyBriefSchema>
export type CreateCreativeJobInput = z.infer<typeof createCreativeJobSchema>
export type UpdateCreativeJobInput = z.infer<typeof updateCreativeJobSchema>

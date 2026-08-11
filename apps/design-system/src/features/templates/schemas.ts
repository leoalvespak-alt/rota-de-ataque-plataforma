import { z } from 'zod'

export const canvasFormatSchema = z.enum(['square', 'portrait'])
export const formatFilterSchema = z.enum(['square', 'portrait', 'carousel'])
export const careerTagSchema = z.enum(['fiscal', 'policial', 'tribunal', 'motivacao'])

export const fieldTypeSchema = z.enum(['text', 'image', 'boolean', 'list', 'number'])

export const fieldDefSchema = z.object({
  name: z.string(),
  semantic: z.string(),
  type: fieldTypeSchema,
  required: z.boolean(),
  maxLength: z.number().optional(),
  bindable: z.boolean(),
})

export const fieldSchemaSchema = z.object({
  fields: z.array(fieldDefSchema),
})

export const templateCapabilitiesSchema = z.object({
  image: z.boolean(),
  cta: z.boolean(),
  list: z.boolean(),
  resize: z.boolean(),
  styles: z.array(z.string()),
})

export const templateVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  density: z.enum(['short', 'medium', 'long']),
  itemCount: z.number().optional(),
  hasImage: z.boolean(),
  ctaPosition: z.enum(['none', 'inline', 'footer']).optional(),
})

export const formatEquivalentSchema = z.object({
  format: canvasFormatSchema,
  templateId: z.string(),
})

export const qualityRuleSeveritySchema = z.enum(['error', 'warning', 'info'])
export const qualityRuleCheckSchema = z.enum([
  'required',
  'max-length',
  'image-required',
  'binding',
  'contrast',
])

export const qualityRuleSchema = z.object({
  id: z.string(),
  field: z.string().optional(),
  severity: qualityRuleSeveritySchema,
  check: qualityRuleCheckSchema,
  params: z.record(z.string(), z.unknown()),
})

export const layoutAdjustmentSchema = z.object({
  property: z.enum(['fontScale', 'lineHeight', 'gapScale', 'maxItems', 'variantId']),
  value: z.union([z.string(), z.number()]),
})

export const layoutRuleSchema = z.object({
  contentRange: z.enum(['short', 'medium', 'long']),
  adjustments: z.array(layoutAdjustmentSchema),
})

export const slotConstraintSchema = z.object({
  minWidth: z.number().optional(),
  minHeight: z.number().optional(),
  maxWidth: z.number().optional(),
  maxHeight: z.number().optional(),
  aspectRatio: z.string().optional(),
  allowedTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().optional(),
})

export const slotDefinitionSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'icon', 'badge', 'divider']),
  label: z.string(),
  required: z.boolean().default(false),
  editable: z.boolean().default(true),
  constraints: slotConstraintSchema.optional(),
  defaultValue: z.unknown().optional(),
})

export const templateConstraintsSchema = z.object({
  minTextLength: z.number().optional(),
  maxTextLength: z.number().optional(),
  maxImages: z.number().optional(),
  safeArea: z
    .object({
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
      left: z.number(),
    })
    .optional(),
  density: z.enum(['low', 'medium', 'high']).optional(),
})

export const templateMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string().optional(),
  category: z.string(),
  filter: formatFilterSchema,
  format: canvasFormatSchema,
  tags: z.array(careerTagSchema),
  slots: z.array(slotDefinitionSchema).optional(),
  variants: z.array(templateVariantSchema).optional(),
  constraints: templateConstraintsSchema.optional(),
  equivalents: z.array(formatEquivalentSchema).optional(),
  qualityRules: z.array(qualityRuleSchema).optional(),
  layoutRules: z.array(layoutRuleSchema).optional(),
  capabilities: templateCapabilitiesSchema.optional(),
  fieldSchema: fieldSchemaSchema.optional(),
})

export type TemplateMetadata = z.infer<typeof templateMetadataSchema>
export type SlotDefinition = z.infer<typeof slotDefinitionSchema>
export type SlotConstraint = z.infer<typeof slotConstraintSchema>
export type TemplateConstraints = z.infer<typeof templateConstraintsSchema>

export function validateTemplateMetadata(data: unknown): TemplateMetadata {
  return templateMetadataSchema.parse(data)
}

export function safeValidateTemplateMetadata(
  data: unknown,
): { success: true; data: TemplateMetadata } | { success: false; error: z.ZodError } {
  const result = templateMetadataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

import { z } from 'zod'

export const SCHEMA_VERSION = 1
export type ApplyScope = 'current-card' | 'entire-carousel'
export type PersistScope = 'project' | 'campaign' | 'preset'
export type WorkflowStatus = 'draft' | 'in-review' | 'changes-requested' | 'approved' | 'published'

const recordSchema = z.record(z.string(), z.unknown())

export const decorSchema = z.object({
  texture: z.object({ type: z.enum(['none', 'organic', 'noise', 'hatching']), opacity: z.number().min(0).max(1) }),
  watermark: z.object({
    visible: z.boolean(), text: z.string(),
    position: z.enum(['bottom-right', 'bottom-left', 'bottom-center']), opacity: z.number().min(0).max(1),
  }),
  bgLibraryId: z.string(),
})

export const dataBindingSchema = z.object({
  fieldPath: z.string().min(1),
  sourceKind: z.enum(['reusable-data', 'spreadsheet-column', 'component']),
  sourceId: z.string().min(1),
  frozen: z.boolean(),
})

export const componentOverrideSchema = z.object({
  componentId: z.string().min(1), fieldPath: z.string().min(1), localValue: z.unknown(),
})

export const cardDocumentSchema = z.object({
  id: z.string().min(1), templateId: z.string().min(1), elements: recordSchema, darkMode: z.boolean(),
  decor: decorSchema, variantId: z.string().optional(), bindings: z.array(dataBindingSchema).optional(),
  overrides: z.array(componentOverrideSchema).optional(),
})

export const artifactDocumentSchema = z.object({
  id: z.string().min(1), kind: z.enum(['post', 'story', 'carousel']), cards: z.array(cardDocumentSchema).min(1),
  exportProfileId: z.string().optional(),
})

export const campaignDocumentSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), status: z.enum(['draft', 'in-review', 'changes-requested', 'approved', 'published']),
  presetId: z.string().optional(), artifacts: z.array(artifactDocumentSchema), linkedComponents: z.array(z.object({
    id: z.string(), kind: z.enum(['logo', 'footer', 'seal', 'numbering', 'cta']), data: recordSchema, version: z.number().int().positive(),
  })),
  featurePreferences: z.record(z.string(), z.object({ enabled: z.boolean(), scope: z.enum(['current-card', 'entire-carousel']) })),
})

export const projectDocumentSchema = z.object({
  id: z.string().min(1), schemaVersion: z.number().int().positive(), name: z.string().min(1),
  campaigns: z.array(campaignDocumentSchema),
  preferences: z.object({ defaultPresetId: z.string().optional(), defaultExportProfileId: z.string().optional(), brandLockMode: z.enum(['off', 'warn', 'block']).optional() }),
  createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(),
})

export type DecorDocument = z.infer<typeof decorSchema>
export type DataBinding = z.infer<typeof dataBindingSchema>
export type ComponentOverride = z.infer<typeof componentOverrideSchema>
export type CardDocument = z.infer<typeof cardDocumentSchema>
export type ArtifactDocument = z.infer<typeof artifactDocumentSchema>
export type CampaignDocument = z.infer<typeof campaignDocumentSchema>
export type ProjectDocument = z.infer<typeof projectDocumentSchema>

export function stableId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createProject(name = 'Projeto sem nome'): ProjectDocument {
  const now = Date.now()
  return { id: stableId('project'), schemaVersion: SCHEMA_VERSION, name, campaigns: [], preferences: {}, createdAt: now, updatedAt: now }
}

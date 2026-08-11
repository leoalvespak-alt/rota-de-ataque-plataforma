import { getTemplateById } from '@/features/templates/registry'
import type { FieldDef, LayoutRule, QualityRule, TemplateCapabilities, TemplateDefinition, TemplateVariant } from '@/features/templates/types'

const textSemantics: Record<string, string> = {
  title: 'title', subtitle: 'subtitle', body: 'body', text: 'body', cta: 'cta', eyebrow: 'eyebrow', quote: 'highlight', author: 'caption',
}

function inferFields(defaults: Record<string, unknown>): FieldDef[] {
  return Object.entries(defaults).flatMap(([name, value]) => {
    if (value === false || value === undefined) return []
    const lower = name.toLowerCase()
    const type = Array.isArray(value) ? 'list' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : lower.includes('image') || lower.includes('photo') || lower.includes('img') ? 'image' : 'text'
    return [{ name, semantic: textSemantics[lower] ?? (type === 'image' ? 'image' : name), type, required: ['title', 'headline', 'cta'].includes(lower), maxLength: type === 'text' ? (lower.includes('title') ? 90 : 300) : undefined, bindable: ['text', 'image', 'boolean', 'number'].includes(type) } satisfies FieldDef]
  })
}

function inferCapabilities(fields: FieldDef[]): TemplateCapabilities {
  return { image: fields.some((field) => field.type === 'image'), cta: fields.some((field) => field.semantic === 'cta'), list: fields.some((field) => field.type === 'list'), resize: true, styles: ['title', 'subtitle', 'body', 'highlight', 'caption', 'cta', 'eyebrow', 'list-item'] }
}

const standardRules = (fields: FieldDef[]): QualityRule[] => fields.flatMap((field) => {
  const rules: QualityRule[] = []
  if (field.required) rules.push({ id: `required:${field.name}`, field: field.name, severity: 'error', check: 'required', params: {} })
  if (field.maxLength) rules.push({ id: `length:${field.name}`, field: field.name, severity: 'warning', check: 'max-length', params: { maxLength: field.maxLength } })
  return rules
})

const standardLayouts: LayoutRule[] = [
  { contentRange: 'short', adjustments: [{ property: 'fontScale', value: 1 }] },
  { contentRange: 'medium', adjustments: [{ property: 'fontScale', value: 0.94 }, { property: 'gapScale', value: 0.92 }] },
  { contentRange: 'long', adjustments: [{ property: 'fontScale', value: 0.86 }, { property: 'lineHeight', value: 0.94 }, { property: 'gapScale', value: 0.82 }] },
]

export interface TemplateContract extends Required<Pick<TemplateDefinition, 'fieldSchema' | 'capabilities' | 'variants' | 'qualityRules' | 'layoutRules'>> { templateId: string }

/** Compatível com os 26 templates: metadados declarados têm precedência, inferência é fallback seguro. */
export function getTemplateContract(templateId: string): TemplateContract | undefined {
  const template = getTemplateById(templateId)
  if (!template) return undefined
  const fields = template.fieldSchema?.fields ?? inferFields(template.defaults as Record<string, unknown>)
  const capabilities = template.capabilities ?? inferCapabilities(fields)
  const variants: TemplateVariant[] = template.variants ?? [{ id: 'default', label: 'Padrão', density: 'medium', hasImage: capabilities.image, ctaPosition: capabilities.cta ? 'footer' : 'none' }]
  return { templateId, fieldSchema: { fields }, capabilities, variants, qualityRules: template.qualityRules ?? standardRules(fields), layoutRules: template.layoutRules ?? standardLayouts }
}

export function getEquivalentTemplate(templateId: string, format: 'square' | 'portrait'): string | undefined {
  const template = getTemplateById(templateId)
  if (!template) return undefined
  const equivalent = template.equivalents?.find((entry) => entry.format === format)
  return equivalent?.templateId
}

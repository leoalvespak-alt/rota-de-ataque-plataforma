import type { CardDocument, ComponentOverride } from './documents'
import { stableId } from './documents'

export interface CampaignPreset { id: string; version: number; name: string; createdAt: number; values: Record<string, unknown>; applicableTemplateIds?: string[] }
export interface LinkedComponent { id: string; kind: 'logo' | 'footer' | 'seal' | 'numbering' | 'cta'; data: Record<string, unknown>; version: number }

export function createPreset(name: string, values: Record<string, unknown>): CampaignPreset {
  return { id: stableId('preset'), version: 1, name: name.trim() || 'Preset sem nome', createdAt: Date.now(), values: structuredClone(values) }
}

export function previewPreset(card: CardDocument, preset: CampaignPreset, fields: string[]): CardDocument {
  if (preset.applicableTemplateIds && !preset.applicableTemplateIds.includes(card.templateId)) throw new Error('Preset incompatível com o template atual.')
  const next = structuredClone(card)
  for (const field of fields) if (field in preset.values) next.elements[field] = structuredClone(preset.values[field])
  return next
}

export function resolveLinkedComponent(component: LinkedComponent, overrides: ComponentOverride[] = []): Record<string, unknown> {
  const result = structuredClone(component.data)
  for (const override of overrides.filter((item) => item.componentId === component.id)) result[override.fieldPath] = override.localValue
  return result
}

export function unlinkComponent(card: CardDocument, componentId: string): CardDocument {
  const next = structuredClone(card)
  next.overrides = next.overrides?.filter((override) => override.componentId !== componentId)
  next.bindings = next.bindings?.filter((binding) => binding.sourceId !== componentId)
  return next
}

import { TEMPLATES } from '@/features/templates/registry'

export function selectEditorialTemplate(input: { format: string; text: string; intent?: string | null; needsImage?: boolean; recentTemplateIds?: string[] }) {
  const filter = input.format === 'story' ? 'portrait' : input.format === 'carousel' ? 'carousel' : 'square'
  const candidates = TEMPLATES.filter((template) => template.filter === filter).filter((template) => !input.needsImage || template.capabilities?.image !== false)
  const preferred = candidates.filter((template) => !input.recentTemplateIds?.includes(template.id)); const pool = preferred.length ? preferred : candidates
  const isDense = input.text.length > 400; const ranked = [...pool].sort((a, b) => Number(Boolean(b.capabilities?.list) === isDense) - Number(Boolean(a.capabilities?.list) === isDense) || Number(Boolean(b.capabilities?.image) === Boolean(input.needsImage)) - Number(Boolean(a.capabilities?.image) === Boolean(input.needsImage)))
  return ranked[0] ?? TEMPLATES[0]
}

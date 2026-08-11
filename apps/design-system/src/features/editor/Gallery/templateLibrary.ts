import { getTemplateContract } from '@/domain/templateContracts'
import type { TemplateDefinition } from '@/features/templates/types'
import type {
  TemplateCapabilityFilter,
  TemplateLibrarySort,
  TemplateLibraryView,
} from '@/stores/useTemplateLibraryStore'
import type { CareerTag, FormatFilter } from '@/features/templates/types'

const IMAGE_TEMPLATE_IDS = new Set([
  'sq-text-image',
  'sq-two-images',
  'sq-profile',
  'pt-image',
  'cr-text-image',
])
const LIST_TEMPLATE_IDS = new Set([
  'sq-tip',
  'sq-steps',
  'sq-stats',
  'sq-table',
  'sq-checklist',
  'pt-list',
  'cr-list',
  'cr-comparison',
])
const CTA_TEMPLATE_IDS = new Set(['pt-cta', 'cr-cta'])

export const FORMAT_OPTIONS: { id: 'all' | FormatFilter; label: string }[] = [
  { id: 'all', label: 'Todos os formatos' },
  { id: 'square', label: 'Quadrado' },
  { id: 'portrait', label: 'Story' },
  { id: 'carousel', label: 'Carrossel' },
]

export const SEGMENT_OPTIONS: { id: CareerTag; label: string }[] = [
  { id: 'fiscal', label: 'Fiscal' },
  { id: 'policial', label: 'Policial' },
  { id: 'tribunal', label: 'Tribunal' },
  { id: 'motivacao', label: 'Motivação' },
]

export const CAPABILITY_OPTIONS: { id: TemplateCapabilityFilter; label: string }[] = [
  { id: 'image', label: 'Com imagem' },
  { id: 'list', label: 'Com lista' },
  { id: 'cta', label: 'Com CTA' },
]

export interface TemplateFilterState {
  query: string
  format: 'all' | FormatFilter
  segments: CareerTag[]
  capabilities: TemplateCapabilityFilter[]
  view: TemplateLibraryView
  sort: TemplateLibrarySort
  favoriteIds: string[]
  recentIds: string[]
}

export function getTemplateLibraryCapabilities(template: TemplateDefinition<never>) {
  const inferred = getTemplateContract(template.id)?.capabilities
  return {
    image: Boolean(inferred?.image || IMAGE_TEMPLATE_IDS.has(template.id)),
    list: Boolean(inferred?.list || LIST_TEMPLATE_IDS.has(template.id)),
    cta: Boolean(inferred?.cta || CTA_TEMPLATE_IDS.has(template.id)),
  }
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()

export function filterTemplates(
  templates: TemplateDefinition<never>[],
  filters: TemplateFilterState,
): TemplateDefinition<never>[] {
  const query = normalize(filters.query)
  const favorites = new Set(filters.favoriteIds)
  const recentIndex = new Map(filters.recentIds.map((id, index) => [id, index]))

  const filtered = templates.filter((template) => {
    if (filters.view === 'favorites' && !favorites.has(template.id)) return false
    if (filters.view === 'recent' && !recentIndex.has(template.id)) return false
    if (filters.format !== 'all' && template.filter !== filters.format) return false
    if (filters.segments.length > 0 && !filters.segments.some((tag) => template.tags.includes(tag)))
      return false

    if (filters.capabilities.length > 0) {
      const capabilities = getTemplateLibraryCapabilities(template)
      if (!filters.capabilities.every((capability) => capabilities[capability])) return false
    }

    if (query) {
      const searchable = normalize(
        `${template.name} ${template.category} ${template.tags.join(' ')}`,
      )
      if (!searchable.includes(query)) return false
    }

    return true
  })

  if (filters.sort === 'name') {
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }

  if (filters.sort === 'recent' || filters.view === 'recent') {
    return [...filtered].sort(
      (left, right) =>
        (recentIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (recentIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }

  return filtered
}

export function getActiveFilterCount(
  filters: Pick<TemplateFilterState, 'query' | 'format' | 'segments' | 'capabilities' | 'view'>,
) {
  return (
    Number(Boolean(filters.query.trim())) +
    Number(filters.format !== 'all') +
    filters.segments.length +
    filters.capabilities.length +
    Number(filters.view !== 'all')
  )
}

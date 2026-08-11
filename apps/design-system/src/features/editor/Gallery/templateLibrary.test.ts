import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '@/features/templates/registry'
import type { TemplateFilterState } from './templateLibrary'
import { filterTemplates, getActiveFilterCount } from './templateLibrary'

const DEFAULT_FILTERS: TemplateFilterState = {
  query: '',
  format: 'all',
  segments: [],
  capabilities: [],
  view: 'all',
  sort: 'relevance',
  favoriteIds: [],
  recentIds: [],
}

describe('templateLibrary', () => {
  it('combina formato e segmentos sem misturar as dimensões', () => {
    const result = filterTemplates(TEMPLATES, {
      ...DEFAULT_FILTERS,
      format: 'portrait',
      segments: ['motivacao'],
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((template) => template.filter === 'portrait')).toBe(true)
    expect(result.every((template) => template.tags.includes('motivacao'))).toBe(true)
  })

  it('busca ignorando acentos e inclui nome e categoria', () => {
    expect(
      filterTemplates(TEMPLATES, { ...DEFAULT_FILTERS, query: 'citacao' }).map((item) => item.id),
    ).toEqual(expect.arrayContaining(['sq-quote', 'pt-quote']))
    expect(
      filterTemplates(TEMPLATES, { ...DEFAULT_FILTERS, query: 'carrosseis' }).length,
    ).toBeGreaterThan(0)
  })

  it('filtra favoritos e mantém a ordem de uso recente', () => {
    const favorites = filterTemplates(TEMPLATES, {
      ...DEFAULT_FILTERS,
      view: 'favorites',
      favoriteIds: ['pt-cover', 'sq-cover'],
    })
    const recent = filterTemplates(TEMPLATES, {
      ...DEFAULT_FILTERS,
      view: 'recent',
      recentIds: ['pt-cover', 'sq-cover'],
    })

    expect(favorites.map((item) => item.id)).toEqual(['sq-cover', 'pt-cover'])
    expect(recent.map((item) => item.id)).toEqual(['pt-cover', 'sq-cover'])
  })

  it('usa as capacidades inferidas para filtros avançados', () => {
    const result = filterTemplates(TEMPLATES, { ...DEFAULT_FILTERS, capabilities: ['image'] })

    expect(result.map((item) => item.id)).toContain('sq-text-image')
    expect(result.map((item) => item.id)).not.toContain('sq-cover')
  })

  it('conta somente filtros ativos', () => {
    expect(getActiveFilterCount(DEFAULT_FILTERS)).toBe(0)
    expect(
      getActiveFilterCount({
        ...DEFAULT_FILTERS,
        query: 'capa',
        format: 'square',
        segments: ['fiscal'],
      }),
    ).toBe(3)
  })
})

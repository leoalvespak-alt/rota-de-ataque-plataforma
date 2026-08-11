import { beforeEach, describe, expect, it } from 'vitest'
import { useTemplateLibraryStore } from './useTemplateLibraryStore'

describe('useTemplateLibraryStore', () => {
  beforeEach(() => {
    useTemplateLibraryStore.persist.clearStorage()
    useTemplateLibraryStore.setState({
      isOpen: false,
      panelTab: 'models',
      query: '',
      format: 'all',
      segments: [],
      capabilities: [],
      view: 'all',
      sort: 'relevance',
      favoriteIds: [],
      recentIds: [],
    })
  })

  it('mantém modelos e edições como áreas independentes da galeria', () => {
    useTemplateLibraryStore.getState().setPanelTab('editions')
    expect(useTemplateLibraryStore.getState().panelTab).toBe('editions')

    useTemplateLibraryStore.getState().setPanelTab('models')
    expect(useTemplateLibraryStore.getState().panelTab).toBe('models')
  })

  it('adiciona e remove favoritos sem duplicar ids', () => {
    useTemplateLibraryStore.getState().toggleFavorite('sq-cover')
    expect(useTemplateLibraryStore.getState().favoriteIds).toEqual(['sq-cover'])

    useTemplateLibraryStore.getState().toggleFavorite('sq-cover')
    expect(useTemplateLibraryStore.getState().favoriteIds).toEqual([])
  })

  it('move o último modelo usado para o início e limita o histórico', () => {
    for (let index = 0; index < 15; index += 1) {
      useTemplateLibraryStore.getState().markRecent(`template-${index}`)
    }
    useTemplateLibraryStore.getState().markRecent('template-5')

    const recentIds = useTemplateLibraryStore.getState().recentIds
    expect(recentIds).toHaveLength(12)
    expect(recentIds[0]).toBe('template-5')
    expect(new Set(recentIds).size).toBe(recentIds.length)
  })

  it('limpa filtros sem apagar favoritos e recentes', () => {
    useTemplateLibraryStore.setState({
      query: 'story',
      format: 'portrait',
      segments: ['fiscal'],
      capabilities: ['image'],
      view: 'favorites',
      sort: 'name',
      favoriteIds: ['pt-cover'],
      recentIds: ['pt-cover'],
    })

    useTemplateLibraryStore.getState().resetFilters()
    const state = useTemplateLibraryStore.getState()
    expect(state).toMatchObject({
      query: '',
      format: 'all',
      segments: [],
      capabilities: [],
      view: 'all',
      sort: 'relevance',
    })
    expect(state.favoriteIds).toEqual(['pt-cover'])
    expect(state.recentIds).toEqual(['pt-cover'])
  })
})

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CareerTag, FormatFilter } from '@/features/templates/types'

export type TemplateLibraryView = 'all' | 'favorites' | 'recent'
export type TemplateLibrarySort = 'relevance' | 'name' | 'recent'
export type TemplateCapabilityFilter = 'image' | 'list' | 'cta'
export type GalleryPanelTab = 'models' | 'editions'

interface TemplateLibraryState {
  isOpen: boolean
  panelTab: GalleryPanelTab
  query: string
  format: 'all' | FormatFilter
  segments: CareerTag[]
  capabilities: TemplateCapabilityFilter[]
  view: TemplateLibraryView
  sort: TemplateLibrarySort
  favoriteIds: string[]
  recentIds: string[]
  carouselSelectionMode: boolean
  selectedCarouselTemplateIds: string[]
  openLibrary: () => void
  closeLibrary: () => void
  setPanelTab: (tab: GalleryPanelTab) => void
  setQuery: (query: string) => void
  setFormat: (format: 'all' | FormatFilter) => void
  toggleSegment: (segment: CareerTag) => void
  toggleCapability: (capability: TemplateCapabilityFilter) => void
  setView: (view: TemplateLibraryView) => void
  setSort: (sort: TemplateLibrarySort) => void
  toggleFavorite: (templateId: string) => void
  markRecent: (templateId: string) => void
  startCarouselSelection: () => void
  toggleCarouselTemplate: (templateId: string) => void
  clearCarouselSelection: () => void
  resetFilters: () => void
}

const toggleValue = <T extends string>(values: T[], value: T) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value]

export const useTemplateLibraryStore = create<TemplateLibraryState>()(
  persist(
    (set) => ({
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
      carouselSelectionMode: false,
      selectedCarouselTemplateIds: [],
      openLibrary: () => set({ isOpen: true }),
      closeLibrary: () => set({ isOpen: false }),
      setPanelTab: (panelTab) => set({ panelTab }),
      setQuery: (query) => set({ query }),
      setFormat: (format) => set({ format }),
      toggleSegment: (segment) =>
        set((state) => ({ segments: toggleValue(state.segments, segment) })),
      toggleCapability: (capability) =>
        set((state) => ({ capabilities: toggleValue(state.capabilities, capability) })),
      setView: (view) => set({ view }),
      setSort: (sort) => set({ sort }),
      toggleFavorite: (templateId) =>
        set((state) => ({ favoriteIds: toggleValue(state.favoriteIds, templateId) })),
      markRecent: (templateId) =>
        set((state) => ({
          recentIds: [templateId, ...state.recentIds.filter((id) => id !== templateId)].slice(
            0,
            12,
          ),
        })),
      startCarouselSelection: () =>
        set({
          carouselSelectionMode: true,
          selectedCarouselTemplateIds: [],
          format: 'carousel',
        }),
      toggleCarouselTemplate: (templateId) =>
        set((state) => ({
          selectedCarouselTemplateIds: toggleValue(state.selectedCarouselTemplateIds, templateId),
        })),
      clearCarouselSelection: () =>
        set({ carouselSelectionMode: false, selectedCarouselTemplateIds: [] }),
      resetFilters: () =>
        set({
          query: '',
          format: 'all',
          segments: [],
          capabilities: [],
          view: 'all',
          sort: 'relevance',
        }),
    }),
    {
      name: 'rda_template_library',
      partialize: (state) => ({ favoriteIds: state.favoriteIds, recentIds: state.recentIds }),
    },
  ),
)

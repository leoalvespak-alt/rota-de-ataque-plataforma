import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { TextureType, WatermarkPosition } from './useDecorStore'

export interface SeriesSlide {
  id: string
  templateId: string
  elements: Record<string, unknown>
  darkMode: boolean
  watermark: { enabled: boolean; text: string; position: WatermarkPosition; opacity: number }
  texture: { type: TextureType; enabled: boolean; opacity: number }
}

interface SeriesState {
  seriesMode: boolean
  slides: SeriesSlide[]
  activeSlideId: string | null
}

interface SeriesActions {
  toggleSeriesMode: () => void
  addSlide: (slide: Omit<SeriesSlide, 'id'>) => void
  loadSlide: (id: string) => SeriesSlide | undefined
  setActiveSlide: (id: string | null) => void
  updateSlide: (id: string, slide: Omit<SeriesSlide, 'id'>) => void
  deleteSlide: (id: string) => void
  reorderSlides: (fromIndex: number, toIndex: number) => void
  replaceSlides: (slides: SeriesSlide[]) => void
}

/**
 * Substitui state.seriesMode / state.seriesSlides do Gerador/index.html original
 * (linhas 1959-1960, funções toggleSeriesMode/addSlideToSeries/loadSlideFromSeries/
 * deleteSlideFromSeries, linhas 3770-3812).
 *
 * 🆕 reorderSlides não existia no HTML original — recurso novo da Fase 8 (drag-and-drop
 * via @dnd-kit/sortable), não substitui nenhum comportamento, só adiciona.
 */
export const useSeriesStore = create<SeriesState & SeriesActions>()(
  immer((set, get) => ({
    seriesMode: false,
    slides: [],
    activeSlideId: null,

    toggleSeriesMode: () =>
      set((s) => {
        s.seriesMode = !s.seriesMode
      }),

    addSlide: (slide) =>
      set((s) => {
        const id = crypto.randomUUID()
        s.slides.push({ id, ...structuredClone(slide) })
        s.activeSlideId = id
      }),

    loadSlide: (id) => get().slides.find((sl) => sl.id === id),

    setActiveSlide: (id) =>
      set((s) => {
        s.activeSlideId = id
      }),

    updateSlide: (id, slide) =>
      set((s) => {
        const index = s.slides.findIndex((item) => item.id === id)
        if (index >= 0) s.slides[index] = { id, ...structuredClone(slide) }
      }),

    deleteSlide: (id) =>
      set((s) => {
        s.slides = s.slides.filter((sl) => sl.id !== id)
        if (s.activeSlideId === id) s.activeSlideId = null
      }),

      reorderSlides: (fromIndex, toIndex) =>
      set((s) => {
        const [moved] = s.slides.splice(fromIndex, 1)
        if (moved) s.slides.splice(toIndex, 0, moved)
      }),

      replaceSlides: (slides) =>
        set((s) => {
          s.slides = structuredClone(slides)
          if (!s.activeSlideId || !s.slides.some((slide) => slide.id === s.activeSlideId)) {
            s.activeSlideId = s.slides[0]?.id ?? null
          }
        }),
  })),
)

import { beforeEach, describe, expect, it } from 'vitest'
import { useSeriesStore, type SeriesSlide } from './useSeriesStore'

const makeSlide = (templateId: string): Omit<SeriesSlide, 'id'> => ({
  templateId,
  elements: { title: templateId },
  darkMode: false,
  watermark: { enabled: false, text: 'Rota de Ataque', position: 'bottom-right', opacity: 0.6 },
  texture: { type: 'none', enabled: false, opacity: 0.08 },
})

describe('useSeriesStore', () => {
  beforeEach(() => {
    useSeriesStore.setState({ seriesMode: true, slides: [], activeSlideId: null })
  })

  it('adiciona um slide e o torna ativo', () => {
    useSeriesStore.getState().addSlide(makeSlide('cr-cover'))

    const state = useSeriesStore.getState()
    expect(state.slides).toHaveLength(1)
    expect(state.activeSlideId).toBe(state.slides[0]?.id)
  })

  it('atualiza somente o slide ativo informado', () => {
    useSeriesStore.getState().addSlide(makeSlide('cr-cover'))
    const id = useSeriesStore.getState().activeSlideId!

    useSeriesStore.getState().updateSlide(id, makeSlide('cr-cta'))

    expect(useSeriesStore.getState().slides[0]).toMatchObject({ id, templateId: 'cr-cta' })
  })

  it('preserva a seleção ao substituir a lista e limpa quando o slide some', () => {
    useSeriesStore.getState().addSlide(makeSlide('cr-cover'))
    useSeriesStore.getState().addSlide(makeSlide('cr-cta'))
    const activeId = useSeriesStore.getState().activeSlideId!
    const current = useSeriesStore.getState().slides

    useSeriesStore.getState().replaceSlides(structuredClone(current))
    expect(useSeriesStore.getState().activeSlideId).toBe(activeId)

    useSeriesStore.getState().replaceSlides([current[0]!])
    expect(useSeriesStore.getState().activeSlideId).toBe(current[0]!.id)
  })
})

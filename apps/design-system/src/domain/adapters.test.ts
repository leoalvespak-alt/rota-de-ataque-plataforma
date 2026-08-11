import { afterEach, describe, expect, it } from 'vitest'
import { loadProjectIntoLegacyStores } from './adapters'
import { buildEditorialSeedEditions } from '@/features/editions/editorialSeed'
import { useSeriesStore } from '@/stores/useSeriesStore'

const editions = buildEditorialSeedEditions()

afterEach(() => {
  useSeriesStore.setState({ slides: [], seriesMode: false, activeSlideId: null })
})

describe('loadProjectIntoLegacyStores', () => {
  it('restaura um post sem ativar controles de carrossel', () => {
    const post = editions.find((edition) => edition.campaigns[0]?.artifacts[0]?.kind === 'post')

    expect(post).toBeDefined()
    expect(loadProjectIntoLegacyStores(post!)).toBe(true)
    expect(useSeriesStore.getState().seriesMode).toBe(false)
    expect(useSeriesStore.getState().slides).toEqual([])
    expect(useSeriesStore.getState().activeSlideId).toBeNull()
  })

  it('restaura todos os cards e ativa o modo série para um carrossel', () => {
    const carousel = editions.find(
      (edition) => edition.campaigns[0]?.artifacts[0]?.kind === 'carousel',
    )

    expect(carousel).toBeDefined()
    expect(loadProjectIntoLegacyStores(carousel!)).toBe(true)
    expect(useSeriesStore.getState().seriesMode).toBe(true)
    expect(useSeriesStore.getState().slides).toHaveLength(5)
    expect(useSeriesStore.getState().activeSlideId).toBe(useSeriesStore.getState().slides[0]?.id)
  })
})

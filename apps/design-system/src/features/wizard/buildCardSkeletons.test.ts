import { describe, expect, it } from 'vitest'
import { buildCardSkeletons } from './buildCardSkeletons'

function ids() {
  let value = 0
  return () => `card-${++value}`
}

describe('buildCardSkeletons', () => {
  it('creates one card for a static post', () => {
    const cards = buildCardSkeletons('sq-impact', 8, null, 'post', ids())
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ id: 'card-1', role: 'cover', templateId: 'sq-impact' })
    expect(Object.keys(cards[0]!.fields).length).toBeGreaterThan(0)
  })

  it('clamps carousel quantity and assigns cover/slide/cta roles', () => {
    const cards = buildCardSkeletons('cr-slide', 50, null, 'carousel', ids())
    expect(cards).toHaveLength(10)
    expect(cards.map((card) => card.role)).toEqual(['cover', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'cta'])
  })

  it('uses every template and role from a preset', () => {
    const cards = buildCardSkeletons(null, 1, 'preset-curto', 'carousel', ids())
    expect(cards.map((card) => [card.role, card.templateId])).toEqual([
      ['cover', 'cr-cover'],
      ['slide', 'cr-slide'],
      ['cta', 'cr-cta'],
    ])
  })

  it('returns no cards when no template or preset exists', () => {
    expect(buildCardSkeletons(null, 3, null, 'carousel', ids())).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { buildEditorialSeedEditions } from './editorialSeed'

describe('editorialSeed', () => {
  it('entrega duas edições de carrossel e um post para cada uma das sete teses', () => {
    const editions = buildEditorialSeedEditions()
    const artifacts = editions.map((edition) => edition.campaigns[0]!.artifacts[0]!)

    expect(editions).toHaveLength(21)
    expect(new Set(editions.map((edition) => edition.id)).size).toBe(21)
    expect(artifacts.filter((artifact) => artifact.kind === 'carousel')).toHaveLength(14)
    expect(artifacts.filter((artifact) => artifact.kind === 'post')).toHaveLength(7)

    for (let thesis = 1; thesis <= 7; thesis++) {
      expect(editions.filter((edition) => edition.name.startsWith(`Tese ${thesis} •`))).toHaveLength(3)
    }
  })

  it('deixa todos os carrosséis completos, editáveis e com variação de layouts', () => {
    const carousels = buildEditorialSeedEditions()
      .map((edition) => edition.campaigns[0]!.artifacts[0]!)
      .filter((artifact) => artifact.kind === 'carousel')
    const templateIds = new Set(carousels.flatMap((artifact) => artifact.cards.map((card) => card.templateId)))

    expect(carousels.every((artifact) => artifact.cards.length === 5)).toBe(true)
    expect(templateIds.size).toBeGreaterThanOrEqual(6)
    expect(carousels.every((artifact) => artifact.cards.every((card) => Object.keys(card.elements).length > 0))).toBe(true)
  })
})

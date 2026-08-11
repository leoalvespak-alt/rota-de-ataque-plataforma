import { describe, expect, it } from 'vitest'
import { getTemplateById } from '@/features/templates/registry'
import { createEditionFromTemplates } from './editionFactory'

const decor = {
  texture: { type: 'none' as const, enabled: false, opacity: 0 },
  watermark: { enabled: true, text: 'Rota de Ataque', position: 'bottom-right' as const, opacity: 0.5 },
  bgLibrarySelected: 'none',
}

describe('createEditionFromTemplates', () => {
  it('clona o modelo para uma edição sem alterar os defaults do catálogo', () => {
    const template = getTemplateById('sq-cover')!
    const edition = createEditionFromTemplates(['sq-cover'], decor)
    const card = edition.campaigns[0]!.artifacts[0]!.cards[0]!

    ;(card.elements as Record<string, unknown>).title = 'COPY DA EDIÇÃO'

    expect(edition.campaigns[0]!.artifacts[0]!.kind).toBe('post')
    expect((template.defaults as Record<string, unknown>).title).not.toBe('COPY DA EDIÇÃO')
  })

  it('preserva a ordem dos modelos ao montar um carrossel', () => {
    const edition = createEditionFromTemplates(['cr-cover', 'cr-slide', 'cr-cta'], decor)
    const artifact = edition.campaigns[0]!.artifacts[0]!

    expect(artifact.kind).toBe('carousel')
    expect(artifact.cards.map((card) => card.templateId)).toEqual(['cr-cover', 'cr-slide', 'cr-cta'])
  })
})

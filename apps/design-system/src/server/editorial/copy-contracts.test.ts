import { describe, expect, it } from 'vitest'
import { buildCaptionPrompt, buildCopyPrompt, splitCopyUnits, toContentFormat } from './copy-contracts'
import { buildSocialCaptionSystemPrompt } from '@/domain/editorial/copyGuidelines'

describe('copy format contracts', () => {
  it('uses distinct instructions for carousels and stories', () => {
    const carousel = buildCopyPrompt({ format: 'carousel', thesis: 'Tese', argument: 'Argumento', hook: 'Abertura', supportingPoints: [] })
    const story = buildCopyPrompt({ format: 'story', thesis: 'Tese', argument: 'Argumento', hook: 'Abertura', supportingPoints: [] })

    expect(carousel).toContain('[[CARD]]')
    expect(carousel).toContain('Não inclua numeração visível de cards.')
    expect(story).toContain('[[FRAME]]')
    expect(story).toContain('quem entrar no meio')
  })

  it('splits explicit markers and removes blank units', () => {
    expect(splitCopyUnits('Capa\n[[CARD]]\n\nExplicação\n[[CARD]]\nAplicação', '[[CARD]]')).toEqual(['Capa', 'Explicação', 'Aplicação'])
  })

  it('falls back to paragraph boundaries when a provider omits markers', () => {
    expect(splitCopyUnits('Primeiro ponto.\n\nSegundo ponto.', '[[FRAME]]')).toEqual(['Primeiro ponto.', 'Segundo ponto.'])
  })

  it('rejects formats without a declared contract', () => {
    expect(() => toContentFormat('unknown')).toThrow('Formato editorial sem contrato')
  })

  it('preserves concrete narrative choices without inventing a testimonial', () => {
    const prompt = buildCopyPrompt({ format: 'carousel', thesis: 'Tese', argument: 'Argumento', hook: 'Abertura', supportingPoints: [] })

    expect(prompt).toContain('Prefira a entrada direta')
    expect(prompt).toContain('cena hipotética identificada como didática')
    expect(prompt).toContain('Nunca invente aluno, depoimento')
    expect(prompt).toContain('gesto concreto')
    expect(prompt).toContain('Não use as palavras ou flexões Tapeçaria')
  })

  it('builds a caption prompt that adds value and only uses a confirmed CTA', () => {
    const prompt = buildCaptionPrompt({
      channel: 'Instagram',
      format: 'carrossel',
      title: 'Como revisar um simulado',
      mediaCopy: 'Registre o motivo de cada erro.',
      verifiedFactsAndSources: 'Procedimento didático próprio; sem alegações externas.',
      verifiedAction: null,
    })

    expect(prompt).toContain('acrescenta uma razão, critério, exemplo didático')
    expect(prompt).toContain('Nenhum. Não invente CTA comercial')
    expect(prompt).toContain('Retorne somente um objeto JSON válido')
    expect(buildSocialCaptionSystemPrompt()).toContain('Não afirme que sabe como o leitor se sente')
  })
})

// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generateMarkdownTemplate } from './generateMarkdownTemplate'
import {
  parseMarkdownScript,
  parsedCardsToScriptCards,
  validateParsedCards,
  MarkdownParseError,
} from './parseMarkdownScript'

function fillTemplate(md: string): string {
  return md
    .replace(/\[TAG CURTA EM MAIÚSCULAS — 1 a 3 palavras\]/g, 'FISCAL HOJE')
    .replace(/\[TÍTULO IMPACTANTE — 4 a 8 palavras em maiúsculas\]/g, 'CONQUISTE SUA APROVAÇÃO AGORA')
    .replace(/\[Texto de apoio — 1 a 2 frases diretas\]/g, 'Execute o plano. Sem desculpas.')
    .replace(/\[TAG CURTA — SLIDE \d+\]/g, 'SLIDE TAG')
    .replace(/\[TÍTULO DO SLIDE \d+\]/g, 'TÍTULO DO SLIDE')
    .replace(/\[Conteúdo principal do slide \d+\]/g, 'Corpo do slide.')
    .replace(/\[TAG DE AÇÃO\]/g, 'AÇÃO FINAL')
    .replace(/\[CHAMADA PARA AÇÃO\]/g, 'CONQUISTE AGORA')
    .replace(/\[Instrução final direta\]/g, 'Clique e comece hoje.')
    .replace(/\[TAG CURTA\]/g, 'TAG')
    .replace(/\[TAG CURTA — SLIDE \d+\]/g, 'TAG')
}

describe('parseMarkdownScript — round-trip', () => {
  it('1 card: parseia só CAPA', () => {
    const md = fillTemplate(generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 1 }))
    const cards = parseMarkdownScript(md)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.role).toBe('cover')
    expect(cards[0]!.title).toBe('CONQUISTE SUA APROVAÇÃO AGORA')
  })

  it('2 cards: CAPA + CTA', () => {
    const md = fillTemplate(generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 2 }))
    const cards = parseMarkdownScript(md)
    expect(cards).toHaveLength(2)
    expect(cards[0]!.role).toBe('cover')
    expect(cards[1]!.role).toBe('cta')
  })

  it('5 cards: CAPA + 3 SLIDES + CTA', () => {
    const md = fillTemplate(generateMarkdownTemplate({ aspectRatio: 'portrait', cardCount: 5 }))
    const cards = parseMarkdownScript(md)
    expect(cards).toHaveLength(5)
    expect(cards[0]!.role).toBe('cover')
    expect(cards[1]!.role).toBe('slide')
    expect(cards[2]!.role).toBe('slide')
    expect(cards[3]!.role).toBe('slide')
    expect(cards[4]!.role).toBe('cta')
  })

  it('10 cards — round-trip completo', () => {
    const md = fillTemplate(generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 10 }))
    const cards = parseMarkdownScript(md)
    expect(cards).toHaveLength(10)
    expect(cards[9]!.role).toBe('cta')
  })
})

describe('parseMarkdownScript — validação', () => {
  it('lança MarkdownParseError se não há seções', () => {
    expect(() => parseMarkdownScript('# Sem seções\nTexto qualquer')).toThrowError(MarkdownParseError)
  })

  it('validateParsedCards detecta campos não preenchidos', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 2 })
    const cards = parseMarkdownScript(md) // campos ainda com [...]
    const warnings = validateParsedCards(cards, 2)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some((w) => w.includes('title'))).toBe(true)
  })

  it('validateParsedCards avisa sobre discrepância de contagem', () => {
    const md = fillTemplate(generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 3 }))
    const cards = parseMarkdownScript(md)
    const warnings = validateParsedCards(cards, 5) // esperava 5, tem 3
    expect(warnings.some((w) => w.includes('3') && w.includes('5'))).toBe(true)
  })
})

describe('parsedCardsToScriptCards', () => {
  it('converte campos não preenchidos para string vazia', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 1 })
    const parsed = parseMarkdownScript(md)
    const scripts = parsedCardsToScriptCards(parsed)
    expect(scripts[0]!.title).toBe('')
    expect(scripts[0]!.eyebrow).toBe('')
  })

  it('gera UUIDs únicos por card', () => {
    const md = fillTemplate(generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 3 }))
    const scripts = parsedCardsToScriptCards(parseMarkdownScript(md))
    const ids = new Set(scripts.map((s) => s.id))
    expect(ids.size).toBe(3)
  })
})

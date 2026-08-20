// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { generateMarkdownTemplate } from './generateMarkdownTemplate'

describe('generateMarkdownTemplate', () => {
  it('1 card — só CAPA, sem CTA', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 1 })
    expect(md).toContain('## CAPA')
    expect(md).not.toContain('## CTA')
    expect(md).not.toContain('## SLIDE')
  })

  it('2 cards — CAPA + CTA', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 2 })
    expect(md).toContain('## CAPA')
    expect(md).toContain('## CTA')
    expect(md).not.toContain('## SLIDE')
  })

  it('3 cards — CAPA + 1 SLIDE + CTA', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 3 })
    expect(md).toContain('## CAPA')
    expect(md).toContain('## SLIDE 1')
    expect(md).toContain('## CTA')
    expect(md).not.toContain('## SLIDE 2')
  })

  it('5 cards — CAPA + 3 SLIDES + CTA', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'portrait', cardCount: 5 })
    expect(md).toContain('## SLIDE 1')
    expect(md).toContain('## SLIDE 2')
    expect(md).toContain('## SLIDE 3')
    expect(md).not.toContain('## SLIDE 4')
    expect(md).toContain('Retrato 1080×1350')
  })

  it('10 cards — máximo suportado', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 10 })
    expect(md).toContain('## SLIDE 8')
    expect(md).not.toContain('## SLIDE 9')
    expect(md).toContain('## CTA')
  })

  it('formato quadrado aparece no cabeçalho', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 3 })
    expect(md).toContain('Quadrado 1080×1080')
  })

  it('contém campos **eyebrow**, **title**, **body** em todos os blocos', () => {
    const md = generateMarkdownTemplate({ aspectRatio: 'square', cardCount: 3 })
    const sections = md.split('---').filter((s) => s.includes('##'))
    expect(sections).toHaveLength(3) // CAPA, SLIDE 1, CTA
    for (const section of sections) {
      expect(section).toContain('**eyebrow**')
      expect(section).toContain('**title**')
      expect(section).toContain('**body**')
    }
  })
})

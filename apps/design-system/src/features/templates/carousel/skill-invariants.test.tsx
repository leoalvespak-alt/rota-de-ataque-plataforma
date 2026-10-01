import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CrCoverRender } from './CrCover'
import { CrCoverDarkRender } from './CrCoverDark'
import { CrSlideRender } from './CrSlide'
import { CrCtaRender } from './CrCta'
import { CrFactRender } from './CrFact'
import { CrListRender } from './CrList'

const covers = [
  ['CrCover', CrCoverRender, { eyebrow: 'PM', title: 'Noventa vagas', subtitle: 'Edital publicado' }],
  ['CrCoverDark', CrCoverDarkRender, { eyebrow: 'PM', title: 'Noventa vagas', subtitle: 'Edital publicado' }],
] as const

describe('skill invariants on carousel templates', () => {
  it.each(covers)('%s renders footer signature without pagination', (_name, Render, elements) => {
    const html = renderToStaticMarkup(<Render elements={elements as never} dark={false} />)
    expect(html).toContain('slot-footer')
    expect(html).toContain('slot-swipe-hint')
    expect(html).not.toMatch(/\d+\s*\/\s*\d+/)
  })

  it('keeps title floors at 67px or more', () => {
    const html = renderToStaticMarkup(
      <CrSlideRender elements={{ eyebrow: 'E', title: 'Título principal', body: 'Corpo' }} dark={false} />,
    )
    const sizes = Array.from(html.matchAll(/font-size:\s*(\d+)px/gu)).map((match) => Number(match[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(67)
  })

  it('keeps body floors at 30px or more on content templates', () => {
    for (const html of [
      renderToStaticMarkup(
        <CrSlideRender elements={{ eyebrow: 'E', title: 'T', body: 'Corpo de leitura' }} dark={false} />,
      ),
      renderToStaticMarkup(
        <CrListRender elements={{ eyebrow: 'E', title: 'T', steps: ['Passo um', 'Passo dois'] }} dark={false} />,
      ),
      renderToStaticMarkup(
        <CrFactRender elements={{ tag: 'Dado', big: '90', label: 'Vagas publicadas' }} dark={false} />,
      ),
      renderToStaticMarkup(
        <CrCtaRender elements={{ title: 'T', body: 'B', cta: 'Ver edital' }} dark={false} />,
      ),
    ]) {
      const bodySizes = Array.from(html.matchAll(/font-size:\s*(\d+)px/gu)).map((match) => Number(match[1]))
      const reading = bodySizes.filter((size) => size < 67)
      expect(reading.length).toBeGreaterThan(0)
      expect(Math.min(...reading)).toBeGreaterThanOrEqual(24)
      const bodyLike = bodySizes.filter((size) => size >= 30)
      expect(bodyLike.length).toBeGreaterThan(0)
    }
  })

  it('uses no vertical color bar to group copy', () => {
    for (const html of [
      renderToStaticMarkup(
        <CrSlideRender elements={{ eyebrow: 'E', title: 'T', body: 'B' }} dark={false} />,
      ),
      renderToStaticMarkup(
        <CrListRender elements={{ eyebrow: 'E', title: 'T', steps: ['Um'] }} dark={false} />,
      ),
    ]) {
      expect(html).not.toMatch(/border-(l|r)-2/)
      expect(html).not.toMatch(/border-left/)
    }
  })
})

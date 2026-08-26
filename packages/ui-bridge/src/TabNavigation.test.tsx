import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TabArrowButtons } from './TabNavigation'

describe('tab arrow navigation', () => {
  it('renders labelled previous and next controls with edge states', () => {
    const first = renderToStaticMarkup(<TabArrowButtons next={{ label: 'Mercado', href: '/inteligencia/mercado' }} />)
    const middle = renderToStaticMarkup(<TabArrowButtons previous={{ label: 'Radar', href: '/inteligencia/radar' }} next={{ label: 'Concorrentes', href: '/inteligencia/concorrentes' }} />)

    expect(first).toContain('aria-label="Primeira aba"')
    expect(first).toContain('Próxima aba: Mercado')
    expect(middle).toContain('Aba anterior: Radar')
    expect(middle).toContain('Próxima aba: Concorrentes')
  })
})

import { describe, expect, it } from 'vitest'
import { RADAR_SOURCE_DEFINITIONS, parseFeed, parseHtml } from './sources.js'

describe('news-radar source registry', () => {
  it('keeps the collection surface at exactly three specialist portals', () => {
    expect(RADAR_SOURCE_DEFINITIONS).toHaveLength(3)
    expect(RADAR_SOURCE_DEFINITIONS.map(source => source.portal)).toEqual([
      'pci-concursos',
      'ache-concursos',
      'folha-qconcursos',
    ])
  })

  it('parses RSS and Atom without a browser', () => {
    const entries = parseFeed('<feed><entry><title>Concurso PM</title><link href="https://example.test/pm"/><id>pm-1</id><updated>2026-09-01</updated><summary>Edital</summary></entry></feed>')
    expect(entries).toEqual([{ title: 'Concurso PM', link: 'https://example.test/pm', guid: 'pm-1', publishedAt: '2026-09-01', description: 'Edital' }])
  })

  it('extracts only article links from ordinary HTML', () => {
    const source = RADAR_SOURCE_DEFINITIONS[0]!
    const entries = parseHtml(source, '<a href="/login">Entrar</a><a href="/noticias/concurso-pm">Concurso PM abre vagas para soldados</a>')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.link).toBe('https://www.pciconcursos.com.br/noticias/concurso-pm')
  })
})

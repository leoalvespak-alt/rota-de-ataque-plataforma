import { describe, expect, it } from 'vitest'
import { RADAR_SOURCE_DEFINITIONS, nextHtmlPaginationUrl, parseArticleDetails, parseFeed, parseHtml, parseSitemap } from './sources.js'

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

  it('advances only through numeric PCI listing links on the registered HTTPS origin', () => {
    const source = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'pci-concursos')!
    const html = '<a class="page-link" href="/noticias/3">3</a><a class="page-link" rel="next" href="/noticias/2">Próxima</a><a class="page-link" href="https://evil.example/noticias/4">4</a>'
    expect(nextHtmlPaginationUrl(source, html, 'https://www.pciconcursos.com.br/noticias/1'))
      .toBe('https://www.pciconcursos.com.br/noticias/2')
    expect(nextHtmlPaginationUrl(source, '<a class="page-link" href="/noticias/4">4</a>', 'https://www.pciconcursos.com.br/noticias/4'))
      .toBeNull()
    expect(nextHtmlPaginationUrl(source, '<a class="page-link" href="/noticias/2">2</a>', 'https://www.pciconcursos.com.br/noticias/1?x=1'))
      .toBeNull()
  })

  it('parses official news sitemap titles and publication dates while skipping category URLs', () => {
    const source = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'ache-concursos')!
    const xml = '<urlset><url><loc>https://www.acheconcursos.com.br/noticias/gabarito-pmes-93572</loc><news:news><news:publication_date>2026-09-27T21:33:00-03:00</news:publication_date><news:title><![CDATA[Gabarito PMES 2026: veja quando sai o resultado]]></news:title></news:news></url><url><loc>https://www.acheconcursos.com.br/noticias</loc></url></urlset>'

    expect(parseSitemap(source, xml)).toEqual([{
      title: 'Gabarito PMES 2026: veja quando sai o resultado',
      link: 'https://www.acheconcursos.com.br/noticias/gabarito-pmes-93572',
      guid: 'https://www.acheconcursos.com.br/noticias/gabarito-pmes-93572',
      publishedAt: '2026-09-27T21:33:00-03:00',
      description: null,
    }])
  })

  it('fails closed on sitemap indexes until child pagination is supported', () => {
    const source = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'ache-concursos')!
    expect(() => parseSitemap(source, '<sitemapindex><sitemap><loc>https://example.test/news.xml</loc></sitemap></sitemapindex>'))
      .toThrow('Sitemap index requires child-sitemap traversal')
  })

  it('does not turn a sitemap URL into an invented title when news metadata is incomplete', () => {
    const source = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'ache-concursos')!
    const xml = '<urlset><url><loc>https://www.acheconcursos.com.br/noticias/sem-titulo</loc><news:news><news:publication_date>2026-09-27T21:33:00-03:00</news:publication_date></news:news></url></urlset>'
    expect(parseSitemap(source, xml)).toEqual([])
  })

  it('extracts article dates, main body text, and same-host PDF links from supported portal layouts', () => {
    const pci = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'pci-concursos')!
    const ache = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'ache-concursos')!
    const folha = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === 'folha-qconcursos')!

    expect(parseArticleDetails(pci, '<meta itemprop="datePublished" content="2026-09-09T18:53:15-03:00"><h1>Concurso PM confirma edital para soldados</h1><div itemprop="articleBody"><p>Texto principal do artigo.</p><div><p>Segundo parágrafo.</p></div><a href="/documentos/edital.pdf">Edital</a><script>ignorar este trecho</script></div>')).toEqual({
      title: 'Concurso PM confirma edital para soldados',
      publishedAt: '2026-09-09T18:53:15-03:00',
      content: 'Texto principal do artigo. Segundo parágrafo. Edital',
      attachments: ['https://www.pciconcursos.com.br/documentos/edital.pdf'],
    })

    expect(parseArticleDetails(ache, '<time datetime="2026-09-27T21:33:00-03:00"></time><h1>Concurso PMES abre inscrições para soldados</h1><div class="post-content"><p>Corpo da notícia.</p></div>')).toMatchObject({
      title: 'Concurso PMES abre inscrições para soldados',
      publishedAt: '2026-09-27T21:33:00-03:00',
      content: 'Corpo da notícia.',
      attachments: [],
    })

    expect(parseArticleDetails(folha, '<meta property="article:published_time" content="2026-09-27T12:00:00-03:00"><article id="article-content"><p>Notícia da Folha.</p><a href="https://other.example/arquivo.pdf">PDF externo</a></article>')).toMatchObject({
      publishedAt: '2026-09-27T12:00:00-03:00',
      content: 'Notícia da Folha. PDF externo',
      attachments: [],
    })

    expect(parseArticleDetails(pci, '<meta itemprop="datePublished" content="ontem"><div itemprop="articleBody">Texto sem data verificável.</div>').publishedAt).toBeNull()
    expect(parseArticleDetails(pci, '<div itemprop="articleBody">Corpo sem título na página.</div>', 'Título da listagem').title).toBe('Título da listagem')
    expect(parseArticleDetails(pci, '<meta property="og:title" content="Título vindo do Open Graph"><h1 id="logo">PCI Concursos</h1><div itemprop="articleBody">Corpo</div>').title).toBe('Título vindo do Open Graph')
  })
})

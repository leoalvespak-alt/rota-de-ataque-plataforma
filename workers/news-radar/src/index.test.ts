import { describe, expect, it, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import { fetchRssFeed, processNewsRadar, spec, type Repository, type AiClassifier } from './index.js'
import { RADAR_SOURCE_DEFINITIONS, parseHtml } from './sources.js'
import { fetchArticleDetails } from './article-details.js'

describe('news-radar', () => {
  it('declares its worker contract', () => {
    expect(spec.queue).toBe('news-radar')
    expect(spec.outbound).toBe(false)
  })

  const makeRepo = (sources: any[] = [], items: any[] = []): Repository => ({
    getActiveSources: vi.fn().mockResolvedValue(sources.map(source => ({ pagination_cursor: null, pagination_complete: true, ...source }))),
    upsertNewsItem: vi.fn().mockResolvedValue({ id: 'item1', isNew: true, articleDetails: null }),
    saveArticleDetails: vi.fn().mockResolvedValue(undefined),
    markArticleDetailsAttempt: vi.fn().mockResolvedValue(undefined),
    markSourceFetched: vi.fn().mockResolvedValue(undefined),
    incrementSourceFailure: vi.fn().mockResolvedValue(undefined),
    disableSource: vi.fn().mockResolvedValue(undefined),
    getUnclassifiedItems: vi.fn().mockResolvedValue(items),
    persistClassification: vi.fn().mockResolvedValue({ id: 'finding1', isNew: true }),
  })

  it('classifies stored items without fetching active sources when requested', async () => {
    const ai: AiClassifier = { classify: vi.fn().mockResolvedValue({
      concurso_alvo: 'PC', categoria: 'PC', estado: null, banca: null, fase_ciclo: 'banca_definida',
      relevance_score: 0.8, confidence: 0.8, factuality_score: 0.8,
      is_police_relevant: true, is_duplicate: false, reason: 'Teste',
    }) }
    const repo = makeRepo([], [
      { id: 'stored-1', title: 'Concurso para Polícia Civil', summary: 'Banca definida', content: null, url: 'https://test.com/stored-1', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai }, 'classification-only')

    expect(repo.getActiveSources).not.toHaveBeenCalled()
    expect(result).toMatchObject({ fetched: 0, newItems: 0, classified: 1, classificationPending: 0 })
    expect(repo.persistClassification).toHaveBeenCalledOnce()
  })

  it('leaves items unclassified while the classifier is unavailable', async () => {
    const repo = makeRepo([], [
      { id: 'i1', title: 'Edital publicado para PM Bahia 2026', summary: 'Concurso PM BA com 500 vagas', content: null, url: 'https://test.com/1', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai: null }, 'incremental')

    expect(result.classified).toBe(0)
    expect(result.classificationPending).toBe(1)
    expect(result.classificationDeferredReason).toBe('classifier_unavailable')
    expect(repo.persistClassification).not.toHaveBeenCalled()
  })

  it('persists a relevant no-finding decision from the configured classifier', async () => {
    const ai: AiClassifier = { classify: vi.fn().mockResolvedValue({
      concurso_alvo: null, categoria: 'outro', estado: null, banca: null, fase_ciclo: null,
      relevance_score: 0.05, confidence: 0.98, factuality_score: 0.8,
      is_police_relevant: false, is_duplicate: false, reason: 'fora do escopo',
    }) }
    const repo = makeRepo([], [
      { id: 'i2', title: 'Resultado do Enem 2026', summary: 'Notas divulgadas', content: null, url: 'https://test.com/2', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai }, 'incremental')

    expect(result.classified).toBe(1)
    expect(result.findings).toBe(0)
    expect(repo.persistClassification).toHaveBeenCalledWith('i2', expect.objectContaining({ is_police_relevant: false }), null)
  })

  it('keeps high-confidence findings in human review until claim-level JEV evidence exists', async () => {
    const ai: AiClassifier = { classify: vi.fn().mockResolvedValue({
      concurso_alvo: 'PM', categoria: 'PM', estado: 'BA', banca: null, fase_ciclo: 'autorizacao',
      relevance_score: 0.99, confidence: 0.99, factuality_score: 0.99,
      is_police_relevant: true, is_duplicate: false, reason: 'notícia sintética para teste',
    }) }
    const repo = makeRepo([], [
      { id: 'i4', title: 'Concurso da PM da Bahia autorizado', summary: 'Anúncio sintético', content: null, url: 'https://test.com/4', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai }, 'incremental')

    expect(result.findings).toBe(1)
    expect(repo.persistClassification).toHaveBeenCalledWith(
      'i4',
      expect.objectContaining({ confidence: 0.99, factuality_score: 0.99 }),
      expect.objectContaining({ review_status: 'review', auto_content_allowed: false }),
    )
  })

  it('leaves items pending when classification fails instead of using keywords as a fallback', async () => {
    const ai: AiClassifier = { classify: vi.fn().mockRejectedValue(new Error('AI unavailable')) }
    const repo = makeRepo([], [
      { id: 'i3', title: 'Concurso Polícia Civil PE - banca definida', summary: null, content: null, url: 'https://test.com/3', source_name: 'Test' },
    ])

    const result = await processNewsRadar({ repo, ai }, 'incremental')

    expect(ai.classify).toHaveBeenCalled()
    expect(result.findings).toBe(0)
    expect(result.classificationPending).toBe(1)
    expect(result.classificationDeferredReason).toBe('classifier_failed:Error')
    expect(repo.persistClassification).not.toHaveBeenCalled()
  })

  it('disables source after 10 consecutive failures', async () => {
    const source = {
      id: 's1', name: 'Broken Feed', url: 'https://broken.com', feed_url: 'https://broken.com/rss',
      source_type: 'rss' as const, portal: 'test', active: true, etag: null, last_modified: null, failure_count: 9, pagination_cursor: null, pagination_complete: true,
    }
    const repo = makeRepo([source])

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    try {
      await processNewsRadar({ repo, ai: null }, 'full')
      expect(repo.disableSource).toHaveBeenCalledWith('s1', expect.stringContaining('Auto-disabled'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('records HTTP 403 as a source failure instead of an empty successful fetch', async () => {
    const source = {
      id: 's403', name: 'Blocked Feed', url: 'https://blocked.example', feed_url: 'https://blocked.example/rss?token=secret',
      source_type: 'rss' as const, portal: 'test', active: true, etag: null, last_modified: null, failure_count: 0, pagination_cursor: null, pagination_complete: true,
    }
    const repo = makeRepo([source])
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('blocked', { status: 403 }))
    try {
      const result = await processNewsRadar({ repo, ai: null }, 'full')
      expect(result.fetched).toBe(0)
      expect(repo.incrementSourceFailure).toHaveBeenCalledWith('s403', 'Source returned HTTP 403')
      expect(repo.markSourceFetched).not.toHaveBeenCalled()
      expect(repo.incrementSourceFailure).not.toHaveBeenCalledWith('s403', expect.stringContaining('secret'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('rejects unconfigured Querido Diário endpoints instead of silently skipping API sources', async () => {
    const source = {
      id: 'api-pending', name: 'API source awaiting adapter', url: 'https://api.example/gazettes', feed_url: null,
      source_type: 'api' as const, portal: 'querido-diario', active: true, etag: null, last_modified: null, failure_count: 0, pagination_cursor: null, pagination_complete: true,
    }
    const repo = makeRepo([source])

    const result = await processNewsRadar({ repo, ai: null }, 'full')

    expect(result.fetched).toBe(0)
    expect(repo.incrementSourceFailure).toHaveBeenCalledWith('api-pending', 'Querido Diário API source must use the official /gazettes endpoint')
    expect(repo.markSourceFetched).not.toHaveBeenCalled()
  })

  it('refreshes the last-seen time and keeps validators on HTTP 304', async () => {
    const source = {
      id: 's304', name: 'Unchanged Feed', url: 'https://unchanged.example', feed_url: 'https://unchanged.example/rss',
      source_type: 'rss' as const, portal: 'test', active: true, etag: '"old-tag"', last_modified: 'Sun, 20 Sep 2026 10:00:00 GMT', failure_count: 0, pagination_cursor: null, pagination_complete: true,
    }
    const repo = makeRepo([source])
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, {
      status: 304,
      headers: { etag: '"new-tag"', 'last-modified': 'Sun, 27 Sep 2026 10:00:00 GMT' },
    }))
    try {
      const result = await processNewsRadar({ repo, ai: null }, 'full')
      expect(result.fetched).toBe(1)
      expect(repo.markSourceFetched).toHaveBeenCalledWith('s304', '"new-tag"', 'Sun, 27 Sep 2026 10:00:00 GMT', null, true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('cancels a source request on shutdown without counting the cancellation as a source failure', async () => {
    const source = {
      id: 'sshutdown', name: 'Slow Feed', url: 'https://slow.example', feed_url: 'https://slow.example/rss',
      source_type: 'rss' as const, portal: 'test', active: true, etag: null, last_modified: null, failure_count: 0, pagination_cursor: null, pagination_complete: true,
    }
    const repo = makeRepo([source])
    const controller = new AbortController()
    const originalFetch = globalThis.fetch
    let signalFetchStarted!: () => void
    const fetchStarted = new Promise<void>(resolve => { signalFetchStarted = resolve })
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      signalFetchStarted()
    }))
    try {
      const processing = processNewsRadar({ repo, ai: null, signal: controller.signal }, 'full')
      await fetchStarted
      controller.abort(new DOMException('Executor shutdown', 'AbortError'))
      await expect(processing).rejects.toMatchObject({ name: 'AbortError' })
      expect(repo.incrementSourceFailure).not.toHaveBeenCalled()
      expect(repo.disableSource).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reads the Folha daily sitemap delivered as a raw gzip body', async () => {
    const source = {
      id: 'folha-test', name: 'Folha Dirigida por Qconcursos', url: 'https://folha.qconcursos.com/', feed_url: null,
      source_type: 'html' as const, portal: 'folha-qconcursos', active: true, etag: null, last_modified: null,
      failure_count: 0, last_fetched_at: null, pagination_cursor: null, pagination_complete: true,
    }
    const xml = '<urlset><url><loc>https://folha.qconcursos.com/n/concurso-ibge-provas-2026</loc><lastmod>2026-09-27T17:46:52-03:00</lastmod><news:news><news:publication_date>2026-09-27T12:00:00-03:00</news:publication_date><news:title>Concurso IBGE: veja como foram as provas</news:title></news:news></url></urlset>'
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValue(new Response(gzipSync(Buffer.from(xml)), {
      headers: { 'content-type': 'application/x-gzip' },
    }))
    globalThis.fetch = fetchMock
    try {
      const result = await fetchRssFeed(source)
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://folha.qconcursos.com/daily_sitemap.xml.gz')
      expect(result.entries).toEqual([expect.objectContaining({
        title: 'Concurso IBGE: veja como foram as provas',
        link: 'https://folha.qconcursos.com/n/concurso-ibge-provas-2026',
        publishedAt: '2026-09-27T12:00:00-03:00',
      })])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('bounds a PCI listing scan and returns a durable cursor for the next run', async () => {
    const source = {
      id: 'pci-pages', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null,
      failure_count: 0, last_fetched_at: null, pagination_cursor: null, pagination_complete: false,
    }
    const originalFetch = globalThis.fetch
    const pageHtml = (page: number) => page < 10
      ? `<a class="page-link" href="/noticias/${page + 1}">${page + 1}</a>`
      : '<div>fim</div>'
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const page = url.pathname === '/noticias' ? 0 : Number(url.pathname.split('/').at(-1))
      return Promise.resolve(new Response(pageHtml(page), { headers: { 'content-type': 'text/html; charset=utf-8' } }))
    })
    globalThis.fetch = fetchMock
    vi.useFakeTimers()
    try {
      const pending = fetchRssFeed(source)
      await vi.runAllTimersAsync()
      const result = await pending
      expect(result.pagesFetched).toBe(10)
      expect(fetchMock).toHaveBeenCalledTimes(10)
      expect(result.paginationCursor).toBe('https://www.pciconcursos.com.br/noticias/10')
      expect(result.paginationComplete).toBe(false)
    } finally {
      vi.useRealTimers()
      globalThis.fetch = originalFetch
    }
  })

  it('resumes a stored PCI cursor after a 304 on the root listing', async () => {
    const source = {
      id: 'pci-resume', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: '"root"', last_modified: null,
      failure_count: 0, last_fetched_at: null, pagination_cursor: 'https://www.pciconcursos.com.br/noticias/17', pagination_complete: false,
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response('<h1>fim</h1>', { headers: { 'content-type': 'text/html' } }))
    globalThis.fetch = fetchMock
    try {
      const result = await fetchRssFeed(source)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(String(fetchMock.mock.calls[1]?.[0])).toBe(source.pagination_cursor)
      expect(result.paginationCursor).toBeNull()
      expect(result.paginationComplete).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('persists the next PCI page from the bounded scan', async () => {
    const source = {
      id: 'pci-process-pages', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null,
      failure_count: 0, last_fetched_at: null, pagination_cursor: 'https://www.pciconcursos.com.br/noticias/10', pagination_complete: false,
    }
    const repo = makeRepo([source])
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = new URL(String(input))
      if (requestUrl.href === source.url) {
        return Promise.resolve(new Response('<a class="page-link" href="/noticias/1">1</a>', { headers: { 'content-type': 'text/html' } }))
      }
      const currentPage = Number(requestUrl.pathname.split('/').at(-1))
      return Promise.resolve(new Response(`<a class="page-link" href="/noticias/${currentPage + 1}">${currentPage + 1}</a>`, { headers: { 'content-type': 'text/html' } }))
    })
    vi.useFakeTimers()
    try {
      const pending = processNewsRadar({ repo, ai: null }, 'incremental')
      await vi.runAllTimersAsync()
      await pending
      expect(repo.markSourceFetched).toHaveBeenCalledWith(
        source.id, null, null, 'https://www.pciconcursos.com.br/noticias/19', false,
      )
    } finally {
      vi.useRealTimers()
      globalThis.fetch = originalFetch
    }
  })

  it('does not mark a PCI source successful when a secondary page is denied', async () => {
    const source = {
      id: 'pci-page-denied', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null,
      failure_count: 0, last_fetched_at: null, pagination_cursor: null, pagination_complete: true,
    }
    const repo = makeRepo([source])
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => String(input) === source.url
      ? Promise.resolve(new Response('<a class="page-link" href="/noticias/1">1</a>', { headers: { 'content-type': 'text/html' } }))
      : Promise.resolve(new Response('blocked', { status: 403 })))
    try {
      await processNewsRadar({ repo, ai: null }, 'incremental')
      expect(repo.incrementSourceFailure).toHaveBeenCalledWith(source.id, 'Source returned HTTP 403')
      expect(repo.markSourceFetched).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('fetches and normalizes article details with same-origin validators', async () => {
    const source = {
      id: 'pci-details', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null, failure_count: 0, last_fetched_at: null, pagination_cursor: null, pagination_complete: true,
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      '<html><head><meta property="article:published_time" content="2026-09-27T10:00:00-03:00"></head><body><h1>Concurso PMMG autorizado</h1><div itemprop="articleBody"><p>O edital terá 500 vagas para a Polícia Militar.</p><a href="/arquivos/edital.pdf">Edital</a><a href="https://external.example/arquivo.pdf">Externo</a></div></body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', etag: '"article-v1"' } },
    ))
    globalThis.fetch = fetchMock
    try {
      const result = await fetchArticleDetails(source, {
        url: 'https://www.pciconcursos.com.br/noticias/concurso-pmmg-autorizado',
        title: 'Concurso PMMG autorizado',
        etag: '"previous"',
        lastModified: 'Sat, 26 Sep 2026 10:00:00 GMT',
      })

      expect(result).toMatchObject({
        ok: true,
        status: 200,
        details: {
          title: 'Concurso PMMG autorizado',
          publishedAt: '2026-09-27T13:00:00.000Z',
          content: 'O edital terá 500 vagas para a Polícia Militar. Edital Externo',
          attachments: ['https://www.pciconcursos.com.br/arquivos/edital.pdf'],
        },
        etag: '"article-v1"',
      })
      expect(fetchMock).toHaveBeenCalledWith(
        new URL('https://www.pciconcursos.com.br/noticias/concurso-pmmg-autorizado'),
        expect.objectContaining({ redirect: 'manual', headers: expect.objectContaining({ 'If-None-Match': '"previous"' }) }),
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('blocks article redirects outside the registered source origin', async () => {
    const source = {
      id: 'pci-redirect', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null, failure_count: 0, last_fetched_at: null, pagination_cursor: null, pagination_complete: true,
    }
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://outside.example/collect' },
    }))
    globalThis.fetch = fetchMock
    try {
      await expect(fetchArticleDetails(source, {
        url: 'https://www.pciconcursos.com.br/noticias/concurso-pmmg',
        title: 'Concurso PMMG',
        etag: null,
        lastModified: null,
      })).resolves.toMatchObject({ ok: false, status: 302, failureCode: 'redirect_outside_source_origin' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('honors a 304 response for a versioned article', async () => {
    const source = {
      id: 'pci-304', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null, failure_count: 0, last_fetched_at: null, pagination_cursor: null, pagination_complete: true,
    }
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, {
      status: 304,
      headers: { etag: '"current-article"' },
    }))
    try {
      await expect(fetchArticleDetails(source, {
        url: 'https://www.pciconcursos.com.br/noticias/concurso-pmmg',
        title: 'Concurso PMMG',
        etag: '"previous-article"',
        lastModified: null,
      })).resolves.toMatchObject({ ok: true, status: 304, notModified: true, etag: '"current-article"' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('stores article details from the registered HTML source and records per-item fetch failures', async () => {
    const source = {
      id: 'pci-process', name: 'PCI Concursos', url: 'https://www.pciconcursos.com.br/noticias', feed_url: null,
      source_type: 'html' as const, portal: 'pci-concursos', active: true, etag: null, last_modified: null, failure_count: 0, last_fetched_at: null,
    }
    const repo = makeRepo([source])
    vi.mocked(repo.upsertNewsItem).mockResolvedValue({
      id: 'article-process',
      isNew: true,
      articleDetails: {
        url: 'https://www.pciconcursos.com.br/noticias/concurso-pmmg',
        title: 'Concurso PMMG autorizado',
        etag: null,
        lastModified: null,
      },
    })
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<a href="/noticias/concurso-pmmg">Concurso PMMG autorizado pelo governo estadual</a>', {
        status: 200, headers: { 'content-type': 'text/html' },
      }))
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    globalThis.fetch = fetchMock
    try {
      const result = await processNewsRadar({ repo, ai: null }, 'full')

      expect(result).toMatchObject({ fetched: 1, newItems: 1, detailsFetched: 0, detailsFailed: 1 })
      expect(repo.markArticleDetailsAttempt).toHaveBeenCalledWith('article-process', 429)
      expect(repo.incrementSourceFailure).not.toHaveBeenCalled()
      expect(repo.saveArticleDetails).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('auto-approves trusted high-confidence findings when JEV evidence passes', async () => {
    vi.stubEnv('RADAR_AUTO_CONTENT_ENABLED', 'true')
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
    const ai: AiClassifier = { classify: vi.fn().mockResolvedValue({
      concurso_alvo: 'PM', categoria: 'PM', estado: 'MG', banca: null, fase_ciclo: 'edital_publicado',
      relevance_score: 0.95, confidence: 0.93, factuality_score: 0.9,
      is_police_relevant: true, is_duplicate: false, reason: 'Edital policial publicado.',
    }) }
    const repo = makeRepo([], [
      { id: 'auto-1', title: 'PMMG abre concurso com 90 vagas', summary: 'Edital da PMMG.', content: null, url: 'https://www.pciconcursos.com.br/noticias/pmmg-90', source_name: 'PCI Concursos' },
    ])
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answers: { trava_factual: { type: 'noul', noul: 0.08 } } }),
    }) as unknown as typeof fetch
    try {
      const result = await processNewsRadar({ repo, ai }, 'classification-only')

      expect(result).toMatchObject({ classified: 1, findings: 1, autoApproved: 1 })
      expect(repo.persistClassification).toHaveBeenCalledWith(
        'auto-1',
        expect.anything(),
        expect.objectContaining({ review_status: 'approved', auto_content_allowed: true, auto_evidence: expect.objectContaining({ jevPreserved: 0.92 }) }),
      )
    } finally {
      globalThis.fetch = originalFetch
      vi.unstubAllEnvs()
    }
  })

  it('keeps trusted findings in review when JEV evidence is missing', async () => {
    vi.stubEnv('RADAR_AUTO_CONTENT_ENABLED', 'true')
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
    const ai: AiClassifier = { classify: vi.fn().mockResolvedValue({
      concurso_alvo: 'PM', categoria: 'PM', estado: 'MG', banca: null, fase_ciclo: 'edital_publicado',
      relevance_score: 0.95, confidence: 0.93, factuality_score: 0.9,
      is_police_relevant: true, is_duplicate: false, reason: 'Edital policial publicado.',
    }) }
    const repo = makeRepo([], [
      { id: 'auto-2', title: 'PMMG abre concurso com 90 vagas', summary: 'Edital da PMMG.', content: null, url: 'https://www.pciconcursos.com.br/noticias/pmmg-91', source_name: 'PCI Concursos' },
    ])
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('JEV down')) as unknown as typeof fetch
    try {
      const result = await processNewsRadar({ repo, ai }, 'classification-only')

      expect(result).toMatchObject({ classified: 1, findings: 1, autoApproved: 0 })
      expect(repo.persistClassification).toHaveBeenCalledWith(
        'auto-2',
        expect.anything(),
        expect.objectContaining({ review_status: 'review', auto_content_allowed: false }),
      )
    } finally {
      globalThis.fetch = originalFetch
      vi.unstubAllEnvs()
    }
  })
})

describe('editorial portal HTML parsing', () => {
  it('keeps PCI and Ache article routes while dropping category pages', () => {
    const pci = RADAR_SOURCE_DEFINITIONS.find(source => source.portal === 'pci-concursos')!
    const ache = RADAR_SOURCE_DEFINITIONS.find(source => source.portal === 'ache-concursos')!
    const pciHtml = [
      '<a href="/concursos/">25.874 vagas em concursos públicos</a>',
      '<a href="/noticias/nacional/">Notícias nacionais de concursos públicos</a>',
      '<a href="/noticias/detran-sp-abre-concurso">DETRAN abre concurso público em São Paulo</a>',
    ].join('')
    const acheHtml = [
      '<a href="/noticias">Notícias e novidades de concursos</a>',
      '<a href="/noticias/gabarito-pmes-93572">Gabarito PMES 2026 e resultado da prova</a>',
    ].join('')

    expect(parseHtml(pci, pciHtml).map(entry => entry.link)).toEqual([
      'https://www.pciconcursos.com.br/noticias/detran-sp-abre-concurso',
    ])
    expect(parseHtml(ache, acheHtml).map(entry => entry.link)).toEqual([
      'https://www.acheconcursos.com.br/noticias/gabarito-pmes-93572',
    ])
  })

  it('keeps Folha article routes and extracts the headline separately from its teaser', () => {
    const folha = RADAR_SOURCE_DEFINITIONS.find(source => source.portal === 'folha-qconcursos')!
    const html = [
      '<a href="/e/concursos-policiais">Concursos Policiais e notícias</a>',
      '<article><a href="/n/concurso-ibge-provas-2026"><h2>Concurso IBGE: veja como foram as provas</h2><p>Provas de nível médio aconteceram neste domingo.</p></a></article>',
    ].join('')

    expect(parseHtml(folha, html)).toEqual([expect.objectContaining({
      title: 'Concurso IBGE: veja como foram as provas',
      link: 'https://folha.qconcursos.com/n/concurso-ibge-provas-2026',
    })])
  })
})

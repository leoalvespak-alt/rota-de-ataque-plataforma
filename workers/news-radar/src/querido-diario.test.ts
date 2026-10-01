import { describe, expect, it, vi } from 'vitest'
import type { NewsSource } from './index.js'
import { fetchQueridoDiario, parseQueridoDiarioPage } from './querido-diario.js'

const source: NewsSource = {
  id: 'qd-sp',
  name: 'Querido Diário - São Paulo',
  url: 'https://api.queridodiario.ok.org.br/gazettes?territory_ids=3550308&querystring=concurso%20OR%20pol%C3%ADcia',
  feed_url: null,
  source_type: 'api',
  portal: 'querido-diario',
  active: true,
  etag: null,
  last_modified: null,
  failure_count: 0,
  last_fetched_at: '2026-09-27T10:00:00.000Z',
  pagination_cursor: null,
  pagination_complete: true,
}

function gazette(id: string, date: string) {
  return {
    territory_id: '3550308',
    date,
    scraped_at: '2026-09-27T11:00:00Z',
    url: `https://diario.example.gov.br/edicao/${id}`,
    territory_name: 'São Paulo',
    state_code: 'SP',
    excerpts: [`<em>Concurso público</em> ${id}`],
    edition: id,
    is_extra_edition: false,
    txt_url: `https://data.queridodiario.ok.org.br/files/${id}.txt`,
  }
}

describe('Querido Diário adapter', () => {
  it('maps official gazette dates and excerpts without inventing a news headline', () => {
    const parsed = parseQueridoDiarioPage({ total_gazettes: 1, gazettes: [gazette('123', '2026-09-26')] })

    expect(parsed.total).toBe(1)
    expect(parsed.entries).toEqual([{
      title: 'Diário Oficial de São Paulo (SP) - 2026-09-26, edição 123',
      link: 'https://diario.example.gov.br/edicao/123',
      guid: '3550308:2026-09-26:https://diario.example.gov.br/edicao/123',
      publishedAt: '2026-09-26',
      description: 'Concurso público 123',
      content: null,
    }])
  })

  it('paginates every result in a fixed scraped-at window and preserves configured search filters', async () => {
    const requested: URL[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      requested.push(url)
      const offset = Number(url.searchParams.get('offset'))
      const gazettes = offset === 0 ? [gazette('1', '2026-09-26')] : [gazette('2', '2026-09-27')]
      return new Response(JSON.stringify({ total_gazettes: 2, gazettes }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const wait = vi.fn().mockResolvedValue(undefined)

    const result = await fetchQueridoDiario(source, undefined, {
      fetch: fetch as typeof globalThis.fetch,
      now: () => new Date('2026-09-27T12:00:00.000Z'),
      wait,
    })

    expect(result.pages).toBe(2)
    expect(result.entries).toHaveLength(2)
    expect(requested.map(url => url.searchParams.get('offset'))).toEqual(['0', '1'])
    expect(requested[0]?.searchParams.get('territory_ids')).toBe('3550308')
    expect(requested[0]?.searchParams.get('querystring')).toBe('concurso OR polícia')
    expect(requested[0]?.searchParams.get('scraped_since')).toBe('2026-09-26T10:00:00Z')
    expect(requested[0]?.searchParams.get('scraped_until')).toBe('2026-09-27T12:00:00Z')
    expect(requested[0]?.searchParams.get('sort_by')).toBe('descending_date')
    expect(requested.every(url => url.searchParams.get('size') === '20')).toBe(true)
    expect(wait).toHaveBeenCalledOnce()
  })

  it('requires an explicit territory and query before any request', async () => {
    const fetch = vi.fn()
    const unconfigured = { ...source, url: 'https://api.queridodiario.ok.org.br/gazettes' }

    await expect(fetchQueridoDiario(unconfigured, undefined, { fetch: fetch as typeof globalThis.fetch }))
      .rejects.toMatchObject({ code: 'configuration' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('retries rate-limited pages using Retry-After before returning results', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_gazettes: 1, gazettes: [gazette('1', '2026-09-26')] }), { status: 200 }))
    const wait = vi.fn().mockResolvedValue(undefined)

    const result = await fetchQueridoDiario(source, undefined, {
      fetch: fetch as typeof globalThis.fetch,
      now: () => new Date('2026-09-27T12:00:00.000Z'),
      wait,
    })

    expect(result.entries).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(0, undefined)
  })

  it('rejects page-count drift rather than marking an incomplete window fetched', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_gazettes: 2, gazettes: [gazette('1', '2026-09-26')] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_gazettes: 3, gazettes: [gazette('2', '2026-09-27')] }), { status: 200 }))

    await expect(fetchQueridoDiario(source, undefined, {
      fetch: fetch as typeof globalThis.fetch,
      now: () => new Date('2026-09-27T12:00:00.000Z'),
      wait: vi.fn().mockResolvedValue(undefined),
    })).rejects.toThrow('Querido Diário result count changed during pagination')
  })
})

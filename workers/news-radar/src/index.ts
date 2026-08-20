import { createWorker, type WorkerSpec } from '@plataforma/shared/worker'
import type { Pool } from 'pg'

export const spec: WorkerSpec = {
  queue: 'news-radar',
  requiredRole: 'collector',
  outbound: false,
  inboundDmOnly: false,
  requiresMetaToken: false,
}

export const processJob = createWorker(spec)

export interface NewsSource {
  id: string
  name: string
  url: string
  feed_url: string | null
  source_type: 'rss' | 'scrape' | 'api'
  portal: string
  active: boolean
  etag: string | null
  last_modified: string | null
  failure_count: number
}

export interface NewsItem {
  source_id: string
  external_id: string
  url: string
  url_hash: string
  title: string
  summary: string | null
  content: string | null
  published_at: string | null
}

export interface RadarFinding {
  news_item_id: string
  title: string
  summary: string | null
  source_url: string | null
  source_name: string | null
  concurso_alvo: string | null
  estado: string | null
  banca: string | null
  fase_ciclo: string | null
  relevance_score: number
}

export interface Repository {
  getActiveSources(): Promise<NewsSource[]>
  upsertNewsItem(item: NewsItem): Promise<{ id: string; isNew: boolean }>
  markSourceFetched(sourceId: string, etag: string | null, lastModified: string | null): Promise<void>
  incrementSourceFailure(sourceId: string, error: string): Promise<void>
  disableSource(sourceId: string, reason: string): Promise<void>
  getUnclassifiedItems(limit: number): Promise<Array<{ id: string; title: string; summary: string | null; content: string | null; url: string; source_name: string }>>
  markItemClassified(itemId: string, classification: object): Promise<void>
  insertRadarFinding(finding: RadarFinding): Promise<string>
}

export interface AiClassifier {
  classify(title: string, content: string | null): Promise<{
    concurso_alvo: string | null
    estado: string | null
    banca: string | null
    fase_ciclo: string | null
    relevance_score: number
    is_police_relevant: boolean
  }>
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete('utm_source')
    u.searchParams.delete('utm_medium')
    u.searchParams.delete('utm_campaign')
    u.searchParams.delete('utm_content')
    u.searchParams.delete('utm_term')
    u.searchParams.delete('ref')
    u.searchParams.delete('fbclid')
    u.searchParams.delete('gclid')
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

async function hashUrl(url: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(normalizeUrl(url))
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

interface RssEntry {
  title: string
  link: string
  guid: string
  pubDate: string | null
  description: string | null
}

function parseRssFeed(xml: string): RssEntry[] {
  const entries: RssEntry[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1] ?? ''
    const getTag = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`, 'i')
      return r.exec(itemContent)?.[1]?.trim() ?? ''
    }
    const title = getTag('title')
    const link = getTag('link')
    const guid = getTag('guid') || link
    const pubDate = getTag('pubDate') || getTag('dc:date') || null
    const description = getTag('description') || getTag('content:encoded') || null
    if (title && link) entries.push({ title, link, guid, pubDate, description })
  }
  return entries
}

const POLICE_KEYWORDS = ['policial', 'polícia', 'pm ', 'pmmg', 'pmba', 'pmce', 'pmsp', 'pmal', 'policia militar', 'policia civil', 'policia penal', 'policia federal', 'policia rodoviaria', 'prf', 'gcm', 'guarda municipal', 'guarda civil', 'delegado', 'agente de policia', 'investigador', 'escrivao', 'papiloscopist', 'pcdf', 'pcrj', 'pcba', 'pcpe', 'pces', 'policia penal', 'depen', 'seap', 'agepen']

function keywordClassify(title: string, content: string | null): { concurso_alvo: string | null; estado: string | null; banca: string | null; fase_ciclo: string | null; relevance_score: number; is_police_relevant: boolean } {
  const text = `${title} ${content ?? ''}`.toLowerCase()
  const isPoliceRelevant = POLICE_KEYWORDS.some(kw => text.includes(kw))
  if (!isPoliceRelevant) return { concurso_alvo: null, estado: null, banca: null, fase_ciclo: null, relevance_score: 0.1, is_police_relevant: false }

  let concurso_alvo: string | null = null
  if (/policia militar|pm[a-z]{2}|pm\s/i.test(text)) concurso_alvo = 'PM'
  else if (/policia penal|pp[a-z]{2}|agepen|seap|depen/i.test(text)) concurso_alvo = 'PP'
  else if (/policia civil|pc[a-z]{2}|delegad|investigad|escriv/i.test(text)) concurso_alvo = 'PC'
  else if (/policia federal|pf\s|dpf/i.test(text)) concurso_alvo = 'PF'
  else if (/policia rodoviaria|prf/i.test(text)) concurso_alvo = 'PRF'
  else if (/guarda municipal|guarda civil|gcm/i.test(text)) concurso_alvo = 'GCM'

  let fase_ciclo: string | null = null
  if (/edital publicad|edital aberto|inscrições aberta/i.test(text)) fase_ciclo = 'edital_publicado'
  else if (/banca definid|banca escolhid|organizadora será/i.test(text)) fase_ciclo = 'banca_definida'
  else if (/retifica[çc]/i.test(text)) fase_ciclo = 'retificacao'
  else if (/resultado|gabarito|aprovad/i.test(text)) fase_ciclo = 'resultado'
  else if (/autorizad|autoriza[çc]/i.test(text)) fase_ciclo = 'autorizacao'
  else if (/comiss[aã]o/i.test(text)) fase_ciclo = 'comissao'

  let estado: string | null = null
  const estados = { 'minas gerais': 'MG', 'são paulo': 'SP', 'rio de janeiro': 'RJ', 'bahia': 'BA', 'ceará': 'CE', 'pernambuco': 'PE', 'alagoas': 'AL', 'paraná': 'PR', 'goiás': 'GO', 'rio grande do sul': 'RS', 'pará': 'PA', 'maranhão': 'MA', 'espírito santo': 'ES', 'mato grosso': 'MT', 'rio grande do norte': 'RN', 'distrito federal': 'DF', 'santa catarina': 'SC', 'piauí': 'PI', 'tocantins': 'TO', 'rondônia': 'RO', 'sergipe': 'SE', 'paraíba': 'PB', 'amazonas': 'AM', 'acre': 'AC', 'amapá': 'AP', 'roraima': 'RR', 'mato grosso do sul': 'MS' }
  for (const [name, uf] of Object.entries(estados)) {
    if (text.includes(name) || new RegExp(`\\b${uf}\\b`).test(text.toUpperCase())) { estado = uf; break }
  }

  const bancas = ['cebraspe', 'cespe', 'fgv', 'vunesp', 'idecan', 'aocp', 'ibfc', 'instituto avalia', 'funcab', 'nucepe', 'fumarc', 'fundep']
  const banca = bancas.find(b => text.includes(b)) ?? null

  let relevance_score = 0.5
  if (fase_ciclo === 'edital_publicado' || fase_ciclo === 'banca_definida') relevance_score = 0.9
  if (concurso_alvo) relevance_score += 0.1

  return { concurso_alvo, estado, banca, fase_ciclo, relevance_score: Math.min(relevance_score, 1), is_police_relevant: true }
}

export interface NewsRadarDeps {
  repo: Repository
  ai: AiClassifier | null
}

export async function fetchRssFeed(source: NewsSource): Promise<{ entries: RssEntry[]; etag: string | null; lastModified: string | null; notModified: boolean }> {
  const headers: Record<string, string> = { 'User-Agent': 'PlataformaNewsRadar/1.0' }
  if (source.etag) headers['If-None-Match'] = source.etag
  if (source.last_modified) headers['If-Modified-Since'] = source.last_modified

  const response = await fetch(source.feed_url ?? source.url, { headers, signal: AbortSignal.timeout(30_000) })
  if (response.status === 304) return { entries: [], etag: source.etag, lastModified: source.last_modified, notModified: true }

  const xml = await response.text()
  return {
    entries: parseRssFeed(xml),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    notModified: false,
  }
}

export async function processNewsRadar(deps: NewsRadarDeps, mode: 'incremental' | 'full'): Promise<{ fetched: number; newItems: number; classified: number; findings: number }> {
  const sources = await deps.repo.getActiveSources()
  let fetched = 0, newItems = 0

  for (const source of sources) {
    if (source.source_type !== 'rss' && mode === 'incremental') continue
    if (!source.feed_url && source.source_type === 'rss') continue

    try {
      const { entries, etag, lastModified, notModified } = await fetchRssFeed(source)
      if (notModified) { fetched++; continue }

      for (const entry of entries) {
        const urlHash = await hashUrl(entry.link)
        const result = await deps.repo.upsertNewsItem({
          source_id: source.id,
          external_id: entry.guid,
          url: normalizeUrl(entry.link),
          url_hash: urlHash,
          title: entry.title,
          summary: entry.description,
          content: null,
          published_at: entry.pubDate,
        })
        if (result.isNew) newItems++
      }

      await deps.repo.markSourceFetched(source.id, etag, lastModified)
      fetched++
    } catch (error) {
      await deps.repo.incrementSourceFailure(source.id, String(error))
      if (source.failure_count >= 9) {
        await deps.repo.disableSource(source.id, `Auto-disabled after 10 failures: ${String(error)}`)
      }
    }
  }

  const unclassified = await deps.repo.getUnclassifiedItems(100)
  let classified = 0, findings = 0

  for (const item of unclassified) {
    let classification: ReturnType<typeof keywordClassify>

    if (deps.ai) {
      try {
        classification = await deps.ai.classify(item.title, item.content ?? item.summary)
      } catch {
        classification = keywordClassify(item.title, item.content ?? item.summary)
      }
    } else {
      classification = keywordClassify(item.title, item.content ?? item.summary)
    }

    await deps.repo.markItemClassified(item.id, classification)
    classified++

    if (classification.is_police_relevant && classification.relevance_score >= 0.4) {
      await deps.repo.insertRadarFinding({
        news_item_id: item.id,
        title: item.title,
        summary: item.summary,
        source_url: item.url,
        source_name: item.source_name,
        concurso_alvo: classification.concurso_alvo,
        estado: classification.estado,
        banca: classification.banca,
        fase_ciclo: classification.fase_ciclo,
        relevance_score: classification.relevance_score,
      })
      findings++
    }
  }

  return { fetched, newItems, classified, findings }
}

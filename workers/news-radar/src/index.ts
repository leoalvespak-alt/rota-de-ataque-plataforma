import { createWorker, type WorkerSpec } from '@plataforma/shared/worker'
import type { Pool } from 'pg'
import { gunzipSync } from 'node:zlib'
import { nextHtmlPaginationUrl, normalizeSourceEntry, parseFeed, parseHtml, parseSitemap, RADAR_SOURCE_DEFINITIONS, type RadarSourceDefinition, type SourceEntry } from './sources.js'
import { fetchQueridoDiario, QueridoDiarioAdapterError } from './querido-diario.js'
import { fetchArticleDetails, type ArticleDetailsFetchResult, type ArticleDetailsTarget } from './article-details.js'
import { buildAutoEvidence, isTrustedSource, loadJevAutoConfig, scoresPassGate, verifyFactualPreserved } from './jev-verifier.js'

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
  source_type: 'rss' | 'atom' | 'html' | 'api'
  portal: string
  active: boolean
  etag: string | null
  last_modified: string | null
  failure_count: number
  last_fetched_at: string | Date | null
  pagination_cursor: string | null
  pagination_complete: boolean
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
  categoria: string
  relevance_score: number
  confidence: number
  factuality_score: number
  review_status: 'approved' | 'review' | 'rejected'
  auto_content_allowed: boolean
  fingerprint: string
  auto_evidence?: {
    jevPreserved: number
    minRelevance: number
    minConfidence: number
    minFactuality: number
    minPreserved: number
    trustedSource: string
  } | null
}

export interface Repository {
  getActiveSources(): Promise<NewsSource[]>
  upsertNewsItem(item: NewsItem): Promise<{ id: string; isNew: boolean; articleDetails: ArticleDetailsTarget | null }>
  saveArticleDetails(itemId: string, result: Extract<ArticleDetailsFetchResult, { ok: true; status: 200 }>): Promise<void>
  markArticleDetailsAttempt(itemId: string, status: number): Promise<void>
  markSourceFetched(sourceId: string, etag: string | null, lastModified: string | null, paginationCursor: string | null, paginationComplete: boolean): Promise<void>
  incrementSourceFailure(sourceId: string, error: string): Promise<void>
  disableSource(sourceId: string, reason: string): Promise<void>
  getUnclassifiedItems(limit: number): Promise<Array<{ id: string; title: string; summary: string | null; content: string | null; url: string; source_name: string }>>
  persistClassification(itemId: string, classification: RadarClassification, finding: RadarFinding | null): Promise<{ id: string; isNew: boolean }>
}

export interface RadarClassification {
  concurso_alvo: string | null
  categoria: string
  estado: string | null
  banca: string | null
  fase_ciclo: string | null
  relevance_score: number
  confidence: number
  factuality_score: number
  is_police_relevant: boolean
  is_duplicate: boolean
  reason: string
}

export interface AiClassifier {
  classify(title: string, content: string | null, signal?: AbortSignal): Promise<RadarClassification>
}

class RadarSourceHttpError extends Error {
  constructor(readonly status: number) {
    super(`Source returned HTTP ${status}`)
    this.name = 'RadarSourceHttpError'
  }
}

class RadarAdapterUnavailableError extends Error {
  constructor(readonly sourceType: NewsSource['source_type']) {
    super(`Source adapter unavailable for ${sourceType}`)
    this.name = 'RadarAdapterUnavailableError'
  }
}

function safeSourceFailure(error: unknown): string {
  if (error instanceof RadarSourceHttpError) return error.message
  if (error instanceof RadarAdapterUnavailableError) return error.message
  if (error instanceof QueridoDiarioAdapterError) return error.message
  return `Source processing failed (${error instanceof Error ? error.name : 'unknown error'})`
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
  if (/pol[íi]cia militar|pm[a-z]{2}|pm\s/i.test(text)) concurso_alvo = 'PM'
  else if (/pol[íi]cia penal|pp[a-z]{2}|agepen|seap|depen/i.test(text)) concurso_alvo = 'PP'
  else if (/pol[íi]cia civil|pc[a-z]{2}|delegad|investigad|escriv/i.test(text)) concurso_alvo = 'PC'
  else if (/pol[íi]cia federal|pf\s|dpf/i.test(text)) concurso_alvo = 'PF'
  else if (/pol[íi]cia rodovi[aá]ria|prf/i.test(text)) concurso_alvo = 'PRF'
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

function foldForRadar(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const RADAR_STATE_NAMES: Record<string, string> = { acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO' }

function requireRadarClassification(input: Partial<RadarClassification>): asserts input is RadarClassification {
  const isProbability = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
  const isNullableText = (value: unknown) => value === null || typeof value === 'string'

  if (
    typeof input.categoria !== 'string' || input.categoria.trim() === '' ||
    !isNullableText(input.concurso_alvo) || !isNullableText(input.estado) ||
    !isNullableText(input.banca) || !isNullableText(input.fase_ciclo) ||
    !isProbability(input.relevance_score) || !isProbability(input.confidence) || !isProbability(input.factuality_score) ||
    typeof input.is_police_relevant !== 'boolean' || typeof input.is_duplicate !== 'boolean' ||
    typeof input.reason !== 'string' || input.reason.trim() === ''
  ) {
    throw new Error('Radar classifier returned an incomplete or invalid decision')
  }
}

function enrichClassification(title: string, content: string | null, input: Partial<RadarClassification>): RadarClassification {
  requireRadarClassification(input)
  const text = foldForRadar(`${title} ${content ?? ''}`)
  const keyword = keywordClassify(title, content)
  const target = input.concurso_alvo ?? keyword.concurso_alvo
  const state = input.estado ?? keyword.estado ?? Object.entries(RADAR_STATE_NAMES).find(([name]) => text.includes(name))?.[1] ?? null
  return {
    concurso_alvo: target,
    categoria: input.categoria,
    estado: state,
    banca: input.banca ?? keyword.banca,
    fase_ciclo: input.fase_ciclo ?? keyword.fase_ciclo,
    relevance_score: input.relevance_score,
    confidence: input.confidence,
    factuality_score: input.factuality_score,
    is_police_relevant: input.is_police_relevant,
    is_duplicate: input.is_duplicate,
    reason: input.reason,
  }
}

export interface NewsRadarDeps {
  repo: Repository
  ai: AiClassifier | null
  signal?: AbortSignal
  checkpoint?: Record<string, unknown> | null
  onCheckpoint?: (checkpoint: Record<string, unknown>) => Promise<void>
}

async function readLimitedResponse(response: Response, limit: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error('Source response exceeded the configured byte limit')
  }
  if (!response.body) return Buffer.alloc(0)

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      throw new Error('Source response exceeded the configured byte limit')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, total)
}

const MAX_SOURCE_RESPONSE_BYTES = 12 * 1024 * 1024
const MAX_LISTING_PAGES_PER_RUN = 10
const LISTING_PAGE_INTERVAL_MS = 1_100
const MAX_SOURCE_REDIRECTS = 3

function isPciListingPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '')
  return normalized === '/noticias' || /^\/noticias\/\d+$/.test(normalized)
}

async function fetchPaginatedHtmlPage(
  url: string,
  source: RadarSourceDefinition,
  signal?: AbortSignal,
  extraHeaders: Record<string, string> = {},
): Promise<{ response: Response; finalUrl: URL }> {
  const origin = new URL(source.url).origin
  let currentUrl: URL
  try { currentUrl = new URL(url) }
  catch { throw new Error('Invalid source pagination URL') }
  if (currentUrl.protocol !== 'https:' || currentUrl.origin !== origin || currentUrl.username || currentUrl.password || !isPciListingPath(currentUrl.pathname)) {
    throw new Error('Source pagination URL is outside the registered HTTPS origin')
  }

  for (let redirects = 0; redirects <= MAX_SOURCE_REDIRECTS; redirects += 1) {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000)
    const response = await fetch(currentUrl, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'PlataformaNewsRadar/1.0', ...extraHeaders },
      redirect: 'manual',
      signal: requestSignal,
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: currentUrl }
    const location = response.headers.get('location')
    await response.body?.cancel().catch(() => undefined)
    if (!location || redirects === MAX_SOURCE_REDIRECTS) throw new Error('Source pagination redirect limit exceeded')
    let nextUrl: URL
    try { nextUrl = new URL(location, currentUrl) }
    catch { throw new Error('Source pagination redirect URL is invalid') }
    if (nextUrl.protocol !== 'https:' || nextUrl.origin !== origin || nextUrl.username || nextUrl.password || !isPciListingPath(nextUrl.pathname)) {
      throw new Error('Source pagination redirect is outside the registered HTTPS origin')
    }
    currentUrl = nextUrl
  }
  throw new Error('Source pagination redirect limit exceeded')
}

function sourcePaginationState(source: NewsSource, result?: unknown) {
  const pagination = typeof result === 'object' && result !== null
    ? result as Record<string, unknown>
    : null
  const hasCursor = pagination !== null && Object.hasOwn(pagination, 'paginationCursor')
  const hasComplete = pagination !== null && Object.hasOwn(pagination, 'paginationComplete')
  return {
    paginationCursor: hasCursor
      ? typeof pagination.paginationCursor === 'string' ? pagination.paginationCursor : null
      : source.pagination_cursor ?? null,
    paginationComplete: hasComplete
      ? pagination.paginationComplete === true
      : source.pagination_complete ?? true,
  }
}

export async function fetchRssFeed(source: NewsSource, signal?: AbortSignal): Promise<{
  entries: SourceEntry[]
  etag: string | null
  lastModified: string | null
  notModified: boolean
  paginationCursor: string | null
  paginationComplete: boolean
  pagesFetched: number
}> {
  const headers: Record<string, string> = { 'User-Agent': 'PlataformaNewsRadar/1.0' }

  const registryDefinition = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === source.portal)
  if (registryDefinition && new URL(source.url).origin !== new URL(registryDefinition.url).origin) {
    throw new Error('Configured source origin does not match the registered portal')
  }
  const sourceDefinition: RadarSourceDefinition = {
    id: source.portal,
    name: source.name,
    url: source.url,
    feedUrl: source.feed_url,
    sitemapUrl: registryDefinition?.sitemapUrl ?? null,
    sourceType: source.source_type === 'html' ? 'html' : source.source_type === 'atom' ? 'atom' : 'rss',
    portal: source.portal,
    rationale: 'runtime source registry',
  }
  const usesSitemap = sourceDefinition.sitemapUrl !== null
  const requestUrl = sourceDefinition.sitemapUrl ?? source.feed_url ?? source.url
  const paginatedPciListing = !usesSitemap && source.source_type === 'html' && source.portal === 'pci-concursos'
  const paginationComplete = paginatedPciListing ? source.pagination_complete : true
  if (!paginatedPciListing || paginationComplete) {
    if (source.etag) headers['If-None-Match'] = source.etag
    if (source.last_modified) headers['If-Modified-Since'] = source.last_modified
  }

  let firstPageUrl = requestUrl
  let response: Response
  if (paginatedPciListing) {
    const firstPage = await fetchPaginatedHtmlPage(requestUrl, sourceDefinition, signal, headers)
    response = firstPage.response
    firstPageUrl = firstPage.finalUrl.href
  } else {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000)
    response = await fetch(requestUrl, { headers, signal: requestSignal })
  }
  const responseEtag = response.headers.get('etag')
  const responseLastModified = response.headers.get('last-modified')
  if (response.status === 304 && (!paginatedPciListing || paginationComplete)) return {
    entries: [],
    etag: responseEtag ?? source.etag,
    lastModified: responseLastModified ?? source.last_modified,
    notModified: true,
    paginationCursor: source.pagination_cursor,
    paginationComplete: source.pagination_complete,
    pagesFetched: 0,
  }
  const resumeAfterNotModified = response.status === 304 && paginatedPciListing && !paginationComplete && Boolean(source.pagination_cursor)
  if (response.status === 304 && paginatedPciListing && !paginationComplete && !source.pagination_cursor) {
    throw new Error('Unfinished source pagination returned 304 without a continuation cursor')
  }
  if (response.status !== 304 && !response.ok) throw new RadarSourceHttpError(response.status)

  const responseBytes = resumeAfterNotModified ? Buffer.alloc(0) : await readLimitedResponse(response, MAX_SOURCE_RESPONSE_BYTES)
  const decodedBytes = usesSitemap && responseBytes[0] === 0x1f && responseBytes[1] === 0x8b
    ? gunzipSync(responseBytes, { maxOutputLength: MAX_SOURCE_RESPONSE_BYTES })
    : responseBytes
  if (decodedBytes.byteLength > MAX_SOURCE_RESPONSE_BYTES) throw new Error('Decoded source response exceeded the configured byte limit')
  const body = new TextDecoder('utf-8').decode(decodedBytes)
  if (paginatedPciListing && response.status !== 304) {
    const contentType = response.headers.get('content-type') ?? ''
    if (!/^text\/html(?:;|$)|^application\/xhtml\+xml(?:;|$)/i.test(contentType)) {
      throw new Error('Source listing response is not HTML')
    }
  }
  const entriesByUrl = new Map<string, SourceEntry>()
  const addEntries = (entries: SourceEntry[]) => {
    for (const entry of entries) {
      const normalized = normalizeSourceEntry(entry)
      if (!entriesByUrl.has(normalized.link)) entriesByUrl.set(normalized.link, normalized)
    }
  }

  // Count the first-page request even when it returned 304 so the request cap
  // remains stable for both fresh and resumed scans.
  let pagesFetched = 1
  let nextPaginationCursor: string | null = null
  let nextPaginationComplete = true
  if (usesSitemap) addEntries(parseSitemap(sourceDefinition, body))
  else if (source.source_type === 'html') {
    if (!resumeAfterNotModified) addEntries(parseHtml(sourceDefinition, body))
    if (paginatedPciListing) {
      let currentPageUrl = firstPageUrl
      let cursor = source.pagination_cursor
      if (!resumeAfterNotModified) {
        // A changed first page starts a fresh bounded sweep after the previous one completed.
        // An unfinished sweep always resumes its durable cursor to avoid skipping pages.
        cursor = source.pagination_complete
          ? nextHtmlPaginationUrl(sourceDefinition, body, firstPageUrl)
          : cursor ?? nextHtmlPaginationUrl(sourceDefinition, body, firstPageUrl)
      }

      const visited = new Set<string>(resumeAfterNotModified ? [] : [new URL(firstPageUrl).href])
      while (cursor && pagesFetched < MAX_LISTING_PAGES_PER_RUN) {
        signal?.throwIfAborted()
        let pageUrl: URL
        try { pageUrl = new URL(cursor) }
        catch { throw new Error('Stored source pagination cursor is invalid') }
        const expectedOrigin = new URL(sourceDefinition.url).origin
        if (pageUrl.protocol !== 'https:' || pageUrl.origin !== expectedOrigin || !/^\/noticias\/\d+$/.test(pageUrl.pathname.replace(/\/$/, '')) || pageUrl.search || pageUrl.hash) {
          throw new Error('Stored source pagination cursor is outside the registered route')
        }
        if (visited.has(pageUrl.href)) throw new Error('Source pagination cursor cycle detected')
        await new Promise(resolve => setTimeout(resolve, LISTING_PAGE_INTERVAL_MS))
        const page = await fetchPaginatedHtmlPage(pageUrl.href, sourceDefinition, signal)
        if (page.response.status === 304) throw new RadarSourceHttpError(304)
        if (!page.response.ok) throw new RadarSourceHttpError(page.response.status)
        const contentType = page.response.headers.get('content-type') ?? ''
        if (!/^text\/html(?:;|$)|^application\/xhtml\+xml(?:;|$)/i.test(contentType)) {
          throw new Error('Source pagination response is not HTML')
        }
        const pageBytes = await readLimitedResponse(page.response, MAX_SOURCE_RESPONSE_BYTES)
        const pageHtml = new TextDecoder('utf-8', { fatal: true }).decode(pageBytes)
        addEntries(parseHtml(sourceDefinition, pageHtml))
        visited.add(pageUrl.href)
        pagesFetched++
        currentPageUrl = page.finalUrl.href
        cursor = nextHtmlPaginationUrl(sourceDefinition, pageHtml, currentPageUrl)
      }
      nextPaginationCursor = cursor
      nextPaginationComplete = cursor === null
    }
  } else addEntries(parseFeed(body))

  return {
    entries: [...entriesByUrl.values()],
    etag: responseEtag ?? source.etag,
    lastModified: responseLastModified ?? source.last_modified,
    notModified: false,
    paginationCursor: nextPaginationCursor,
    paginationComplete: nextPaginationComplete,
    pagesFetched,
  }
}

export async function processNewsRadar(deps: NewsRadarDeps, mode: 'incremental' | 'full' | 'classification-only'): Promise<{ fetched: number; newItems: number; detailsFetched: number; detailsNotModified: number; detailsFailed: number; detailsDeferredByLimit: number; classified: number; findings: number; autoApproved: number; classificationPending: number; classificationDeferredReason: string | null }> {
  deps.signal?.throwIfAborted()
  const sources = mode === 'classification-only' ? [] : await deps.repo.getActiveSources()
  let fetched = 0, newItems = 0
  let detailsFetched = 0, detailsNotModified = 0, detailsFailed = 0, detailsDeferredByLimit = 0

  for (const [sourceIndex, source] of sources.entries()) {
    deps.signal?.throwIfAborted()
    if (!source.feed_url && (source.source_type === 'rss' || source.source_type === 'atom')) {
      await deps.repo.incrementSourceFailure(source.id, 'RSS/Atom source has no feed URL')
      continue
    }

    try {
      if (source.source_type === 'api' && source.portal !== 'querido-diario') {
        throw new RadarAdapterUnavailableError(source.source_type)
      }
      const fetchedSource = source.source_type === 'api'
        ? await fetchQueridoDiario(source, deps.signal)
        : await fetchRssFeed(source, deps.signal)
      const { entries, etag, lastModified, notModified } = fetchedSource
      const pagination = sourcePaginationState(source, fetchedSource)
      if (notModified) {
        await deps.repo.markSourceFetched(source.id, etag, lastModified, pagination.paginationCursor, pagination.paginationComplete)
        fetched++
        await deps.onCheckpoint?.({ phase: 'collect', lastSourceId: source.id, sourceIndex, fetched, newItems })
        continue
      }

      let articleDetailAttempts = 0
      for (const entry of entries.map(normalizeSourceEntry)) {
        deps.signal?.throwIfAborted()
        const urlHash = await hashUrl(entry.link)
        const result = await deps.repo.upsertNewsItem({
          source_id: source.id,
          external_id: entry.guid,
          url: normalizeUrl(entry.link),
          url_hash: urlHash,
          title: entry.title,
          summary: entry.description,
          content: entry.content ?? null,
          published_at: entry.publishedAt,
        })
        if (result.isNew) newItems++

        const detailSource = RADAR_SOURCE_DEFINITIONS.some(definition => definition.portal === source.portal && definition.sourceType === 'html')
        if (!detailSource || !result.articleDetails) continue
        if (articleDetailAttempts >= 10) {
          detailsDeferredByLimit++
          continue
        }
        articleDetailAttempts++

        const detailResult = await fetchArticleDetails(source, result.articleDetails, deps.signal)
        if (!detailResult.ok) {
          await deps.repo.markArticleDetailsAttempt(result.id, detailResult.status)
          detailsFailed++
          continue
        }
        if (detailResult.notModified) {
          await deps.repo.markArticleDetailsAttempt(result.id, detailResult.status)
          detailsNotModified++
          continue
        }
        await deps.repo.saveArticleDetails(result.id, detailResult)
        detailsFetched++
      }

      await deps.repo.markSourceFetched(source.id, etag, lastModified, pagination.paginationCursor, pagination.paginationComplete)
      fetched++
      await deps.onCheckpoint?.({ phase: 'collect', lastSourceId: source.id, sourceIndex, fetched, newItems, detailsFetched, detailsNotModified, detailsFailed, detailsDeferredByLimit })
    } catch (error) {
      if (deps.signal?.aborted) throw deps.signal.reason ?? error
      const safeFailure = safeSourceFailure(error)
      await deps.repo.incrementSourceFailure(source.id, safeFailure)
      if (source.failure_count >= 9) {
        await deps.repo.disableSource(source.id, `Auto-disabled after 10 failures: ${safeFailure}`)
      }
    }
  }

  const unclassified = await deps.repo.getUnclassifiedItems(100)
  let classified = 0, findings = 0, autoApproved = 0
  let classificationDeferredReason: string | null = deps.ai ? null : 'classifier_unavailable'
  const autoConfig = loadJevAutoConfig()
  const jevApiKey = process.env.OPENROUTER_API_KEY?.trim() ?? ''

  for (const item of unclassified) {
    deps.signal?.throwIfAborted()
    if (!deps.ai) break

    let classification: RadarClassification
    try {
      classification = enrichClassification(item.title, item.content ?? item.summary, await deps.ai.classify(item.title, item.content ?? item.summary, deps.signal))
    } catch (error) {
      if (deps.signal?.aborted) throw deps.signal.reason
      classificationDeferredReason = `classifier_failed:${error instanceof Error ? error.name : 'unknown'}`
      break
    }

    let finding: RadarFinding | null = null
    if (classification.is_police_relevant && classification.relevance_score >= 0.4 && !classification.is_duplicate) {
      finding = {
        news_item_id: item.id,
        title: item.title,
        summary: item.summary,
        source_url: item.url,
        source_name: item.source_name,
        concurso_alvo: classification.concurso_alvo,
        estado: classification.estado,
        banca: classification.banca,
        fase_ciclo: classification.fase_ciclo,
        categoria: classification.categoria,
        relevance_score: classification.relevance_score,
        confidence: classification.confidence,
        factuality_score: classification.factuality_score,
        // A classifier's self-reported confidence is not claim-level JEV evidence.
        review_status: 'review',
        auto_content_allowed: false,
        fingerprint: await hashUrl(`${item.url}:${classification.categoria}`),
      }
      // Calibrated auto gate: trusted source + high classifier scores + JEV factual
      // evidence. Anything below the bar (or any JEV failure) stays in human review.
      if (
        autoConfig.enabled &&
        isTrustedSource(item.source_name, autoConfig.trustedSources) &&
        scoresPassGate(
          { relevance: classification.relevance_score, confidence: classification.confidence, factuality: classification.factuality_score },
          autoConfig,
        )
      ) {
        const check = await verifyFactualPreserved({
          title: item.title,
          summary: item.summary ?? item.content,
          apiKey: jevApiKey,
          model: autoConfig.model,
          timeoutMs: autoConfig.timeoutMs,
          signal: deps.signal ?? undefined,
        })
        if (check && check.preserved >= autoConfig.minPreserved) {
          finding.review_status = 'approved'
          finding.auto_content_allowed = true
          finding.auto_evidence = buildAutoEvidence({ jevPreserved: check.preserved, sourceName: item.source_name, config: autoConfig })
          autoApproved++
          await deps.onCheckpoint?.({ phase: 'classify', jevCostUsd: check.costUsd, jevModel: check.model, jevInputTokens: check.inputTokens })
        }
      }
    }

    const result = await deps.repo.persistClassification(item.id, classification, finding)
    classified++
    await deps.onCheckpoint?.({ phase: 'classify', lastItemId: item.id, classified, findings, classificationPending: unclassified.length - classified })
    if (finding && result.isNew) {
      findings++
    }
  }

  return { fetched, newItems, detailsFetched, detailsNotModified, detailsFailed, detailsDeferredByLimit, classified, findings, autoApproved, classificationPending: unclassified.length - classified, classificationDeferredReason }
}

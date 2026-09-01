import { createWorker, type WorkerSpec } from '@plataforma/shared/worker'
import type { Pool } from 'pg'
import { normalizeSourceEntry, parseFeed, parseHtml, type RadarSourceDefinition, type SourceEntry } from './sources.js'

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
}

export interface Repository {
  getActiveSources(): Promise<NewsSource[]>
  upsertNewsItem(item: NewsItem): Promise<{ id: string; isNew: boolean }>
  markSourceFetched(sourceId: string, etag: string | null, lastModified: string | null): Promise<void>
  incrementSourceFailure(sourceId: string, error: string): Promise<void>
  disableSource(sourceId: string, reason: string): Promise<void>
  getUnclassifiedItems(limit: number): Promise<Array<{ id: string; title: string; summary: string | null; content: string | null; url: string; source_name: string }>>
  markItemClassified(itemId: string, classification: object): Promise<void>
  insertRadarFinding(finding: RadarFinding): Promise<{ id: string; isNew: boolean }>
  insertContentOpportunity?(finding: RadarFinding, classification: RadarClassification): Promise<void>
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
  classify(title: string, content: string | null): Promise<RadarClassification>
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

const RADAR_CATEGORY_RULES: Array<{ category: string; target: string | null; pattern: RegExp }> = [
  { category: 'PF', target: 'PF', pattern: /policia federal|\bdpf\b|\bpf\b/ },
  { category: 'PRF', target: 'PRF', pattern: /policia rodoviaria federal|\bprf\b/ },
  { category: 'PP', target: 'PP', pattern: /policia penal|policia penitenciaria|agepen|seap|depen/ },
  { category: 'PM', target: 'PM', pattern: /policia militar|\bpm\s?(?:ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)\b/ },
  { category: 'PC', target: 'PC', pattern: /policia civil|\bpc\s?(?:ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)\b|delegad|investigador|escriv/ },
  { category: 'BOMBEIROS', target: 'outro', pattern: /corpo de bombeiros|bombeiro militar|\bcbm\b/ },
  { category: 'TRANSITO', target: 'outro', pattern: /transito|\bdetran\b|policia rodoviaria estadual|agente de transito/ },
  { category: 'SOCIOEDUCATIVO', target: 'outro', pattern: /socioeducativo|agente socioeducativo|fundacao casa/ },
  { category: 'GCM', target: 'GCM', pattern: /guarda municipal|guarda civil|\bgcm\b/ },
]

const RADAR_STATE_NAMES: Record<string, string> = { acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO' }

function enrichClassification(title: string, content: string | null, input: Partial<RadarClassification>): RadarClassification {
  const text = foldForRadar(`${title} ${content ?? ''}`)
  const rule = RADAR_CATEGORY_RULES.find(candidate => candidate.pattern.test(text))
  const keyword = keywordClassify(title, content)
  const category = rule?.category ?? keyword.concurso_alvo ?? (input.categoria ?? 'outro')
  const target = rule?.target ?? input.concurso_alvo ?? keyword.concurso_alvo
  const state = input.estado ?? keyword.estado ?? Object.entries(RADAR_STATE_NAMES).find(([name]) => text.includes(name))?.[1] ?? null
  const relevance = Number.isFinite(Number(input.relevance_score)) ? Number(input.relevance_score) : (rule ? Math.max(keyword.relevance_score, 0.72) : 0.05)
  const confidence = Math.min(1, Math.max(0, Number.isFinite(Number(input.confidence)) ? Number(input.confidence) : 0.82))
  const factuality = Math.min(1, Math.max(0, Number.isFinite(Number(input.factuality_score)) ? Number(input.factuality_score) : 0.35))
  const isRelevant = input.is_police_relevant ?? (Boolean(rule) || keyword.is_police_relevant)
  return {
    concurso_alvo: target,
    categoria: category,
    estado: state,
    banca: input.banca ?? keyword.banca,
    fase_ciclo: input.fase_ciclo ?? keyword.fase_ciclo,
    relevance_score: Math.min(1, Math.max(0, relevance)),
    confidence,
    factuality_score: factuality,
    is_police_relevant: isRelevant,
    is_duplicate: input.is_duplicate === true,
    reason: input.reason ?? (isRelevant ? 'classificação do radar; confirmação editorial necessária' : 'fora do escopo determinístico de segurança pública'),
  }
}

export interface NewsRadarDeps {
  repo: Repository
  ai: AiClassifier | null
}

export async function fetchRssFeed(source: NewsSource): Promise<{ entries: SourceEntry[]; etag: string | null; lastModified: string | null; notModified: boolean }> {
  const headers: Record<string, string> = { 'User-Agent': 'PlataformaNewsRadar/1.0' }
  if (source.etag) headers['If-None-Match'] = source.etag
  if (source.last_modified) headers['If-Modified-Since'] = source.last_modified

  const response = await fetch(source.feed_url ?? source.url, { headers, signal: AbortSignal.timeout(30_000) })
  if (response.status === 304) return { entries: [], etag: source.etag, lastModified: source.last_modified, notModified: true }

  const body = await response.text()
  const sourceDefinition: RadarSourceDefinition = {
    id: source.portal,
    name: source.name,
    url: source.url,
    feedUrl: source.feed_url,
    sourceType: source.source_type === 'html' ? 'html' : source.source_type === 'atom' ? 'atom' : 'rss',
    portal: source.portal,
    rationale: 'runtime source registry',
  }
  return {
    entries: (source.source_type === 'html' ? parseHtml(sourceDefinition, body) : parseFeed(body)).map(normalizeSourceEntry),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    notModified: false,
  }
}

export async function processNewsRadar(deps: NewsRadarDeps, mode: 'incremental' | 'full'): Promise<{ fetched: number; newItems: number; classified: number; findings: number }> {
  const sources = await deps.repo.getActiveSources()
  let fetched = 0, newItems = 0

  for (const source of sources) {
    if (source.source_type === 'api') continue
    if (!source.feed_url && (source.source_type === 'rss' || source.source_type === 'atom')) continue

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
          published_at: entry.publishedAt,
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
    let classification: RadarClassification

    if (deps.ai) {
      try {
        classification = enrichClassification(item.title, item.content ?? item.summary, await deps.ai.classify(item.title, item.content ?? item.summary))
      } catch {
        classification = enrichClassification(item.title, item.content ?? item.summary, keywordClassify(item.title, item.content ?? item.summary))
      }
    } else {
      classification = enrichClassification(item.title, item.content ?? item.summary, keywordClassify(item.title, item.content ?? item.summary))
    }

    await deps.repo.markItemClassified(item.id, classification)
    classified++

    if (classification.is_police_relevant && classification.relevance_score >= 0.4 && !classification.is_duplicate) {
      const safeForAutomaticEditorial = classification.confidence >= 0.85 && classification.factuality_score >= 0.85 && classification.relevance_score >= 0.75
      const finding: RadarFinding = {
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
        review_status: safeForAutomaticEditorial ? 'approved' : 'review',
        auto_content_allowed: safeForAutomaticEditorial,
        fingerprint: await hashUrl(`${item.url}:${classification.categoria}`),
      }
      const result = await deps.repo.insertRadarFinding(finding)
      if (result.isNew) {
        findings++
        if (safeForAutomaticEditorial) await deps.repo.insertContentOpportunity?.(finding, classification)
      }
    }
  }

  return { fetched, newItems, classified, findings }
}

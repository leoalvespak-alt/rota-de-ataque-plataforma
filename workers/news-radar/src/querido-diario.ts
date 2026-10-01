import type { NewsSource } from './index.js'
import type { SourceEntry } from './sources.js'

const API_ORIGIN = 'https://api.queridodiario.ok.org.br'
const PAGE_SIZE = 20
const MAX_PAGES_PER_RUN = 60
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 30_000
const PAGE_INTERVAL_MS = 1_000
const INITIAL_WINDOW_DAYS = 7
const OVERLAP_HOURS = 24
const MAX_RETRIES = 2
const MAX_RETRY_AFTER_MS = 60_000

export class QueridoDiarioAdapterError extends Error {
  constructor(readonly code: 'configuration' | 'http' | 'protocol' | 'capacity', message: string) {
    super(message)
    this.name = 'QueridoDiarioAdapterError'
  }
}

interface GazetteItem {
  territory_id: string
  date: string
  scraped_at: string
  url: string
  territory_name: string
  state_code: string
  excerpts: string[]
  edition?: string | null
  is_extra_edition?: boolean | null
  txt_url?: string | null
}

interface GazettePage {
  total_gazettes: number
  gazettes: GazetteItem[]
}

export interface QueridoDiarioResult {
  entries: SourceEntry[]
  etag: null
  lastModified: null
  notModified: boolean
  pages: number
}

interface QueridoDiarioDependencies {
  fetch?: typeof fetch
  now?: () => Date
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new QueridoDiarioAdapterError('protocol', `Querido Diário response is missing ${key}`)
  }
  return value.trim()
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function validDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

function validWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function parseGazette(value: unknown): GazetteItem {
  if (!isRecord(value)) throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an invalid gazette item')

  const territoryId = requiredText(value, 'territory_id')
  const date = requiredText(value, 'date')
  const scrapedAt = requiredText(value, 'scraped_at')
  const url = requiredText(value, 'url')
  const territoryName = requiredText(value, 'territory_name')
  const stateCode = requiredText(value, 'state_code')
  const excerpts = value.excerpts

  if (!/^\d{7}$/.test(territoryId) || !validDate(date) || !validDateTime(scrapedAt) || !validWebUrl(url)) {
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned invalid gazette metadata')
  }
  if (!Array.isArray(excerpts) || excerpts.some(excerpt => typeof excerpt !== 'string')) {
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned invalid gazette excerpts')
  }
  if (value.edition != null && typeof value.edition !== 'string') {
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an invalid edition')
  }
  if (value.is_extra_edition != null && typeof value.is_extra_edition !== 'boolean') {
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an invalid extra-edition flag')
  }
  if (value.txt_url != null && (typeof value.txt_url !== 'string' || !validWebUrl(value.txt_url))) {
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an invalid TXT URL')
  }

  return {
    territory_id: territoryId,
    date,
    scraped_at: scrapedAt,
    url,
    territory_name: territoryName,
    state_code: stateCode,
    excerpts: excerpts as string[],
    edition: value.edition as string | null | undefined,
    is_extra_edition: value.is_extra_edition as boolean | null | undefined,
    txt_url: value.txt_url as string | null | undefined,
  }
}

function parseGazettePage(value: unknown): GazettePage {
  if (!isRecord(value) || !Number.isInteger(value.total_gazettes) || Number(value.total_gazettes) < 0 || !Array.isArray(value.gazettes)) {
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an invalid page')
  }

  return {
    total_gazettes: Number(value.total_gazettes),
    gazettes: value.gazettes.map(parseGazette),
  }
}

export function parseQueridoDiarioPage(value: unknown): { total: number; entries: SourceEntry[] } {
  const page = parseGazettePage(value)
  return {
    total: page.total_gazettes,
    entries: page.gazettes.map(gazette => {
      const edition = gazette.edition ? `, edição ${gazette.edition}` : ''
      const excerpt = gazette.excerpts.map(text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n')
      return {
        title: `Diário Oficial de ${gazette.territory_name} (${gazette.state_code}) - ${gazette.date}${edition}`,
        link: gazette.url,
        guid: `${gazette.territory_id}:${gazette.date}:${gazette.url}`,
        publishedAt: gazette.date,
        description: excerpt || null,
        content: null,
      }
    }),
  }
}

function formatDateTime(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function subtractDays(value: Date, days: number): Date {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000)
}

function subtractHours(value: Date, hours: number): Date {
  return new Date(value.getTime() - hours * 60 * 60 * 1000)
}

function getConfiguredUrl(source: NewsSource): URL {
  let url: URL
  try {
    url = new URL(source.feed_url ?? source.url)
  } catch {
    throw new QueridoDiarioAdapterError('configuration', 'Querido Diário API source has an invalid endpoint URL')
  }

  if (url.origin !== API_ORIGIN || url.pathname !== '/gazettes' || url.username || url.password) {
    throw new QueridoDiarioAdapterError('configuration', 'Querido Diário API source must use the official /gazettes endpoint')
  }

  const territoryIds = url.searchParams.getAll('territory_ids')
  if (territoryIds.length === 0 || territoryIds.some(id => !/^\d{7}$/.test(id))) {
    throw new QueridoDiarioAdapterError('configuration', 'Querido Diário source requires configured 7-digit territory_ids')
  }
  if (!url.searchParams.get('querystring')?.trim()) {
    throw new QueridoDiarioAdapterError('configuration', 'Querido Diário source requires a non-empty querystring')
  }

  return url
}

function configuredStartDate(url: URL, lastFetchedAt: NewsSource['last_fetched_at'], now: Date): Date {
  if (lastFetchedAt) {
    const lastFetched = new Date(lastFetchedAt)
    if (Number.isNaN(lastFetched.getTime())) {
      throw new QueridoDiarioAdapterError('configuration', 'Querido Diário source has an invalid last_fetched_at value')
    }
    return subtractHours(lastFetched, OVERLAP_HOURS)
  }

  const configured = url.searchParams.get('scraped_since')
  if (configured) {
    const date = new Date(configured)
    if (Number.isNaN(date.getTime())) throw new QueridoDiarioAdapterError('configuration', 'Querido Diário source has an invalid initial scraped_since value')
    return date
  }
  return subtractDays(now, INITIAL_WINDOW_DAYS)
}

function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('The operation was aborted', 'AbortError')
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(abortReason(signal))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function retryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function retryDelay(response: Response, retryIndex: number): number {
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    const retryAt = Number.isFinite(seconds) ? Date.now() + seconds * 1_000 : Date.parse(retryAfter)
    if (Number.isFinite(retryAt)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAt - Date.now()))
  }
  return Math.min(8_000, 1_000 * 2 ** retryIndex)
}

async function requestPage(
  fetchImpl: typeof fetch,
  url: URL,
  signal: AbortSignal | undefined,
  wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'PlataformaNewsRadar/1.0' },
        signal: requestSignal,
      })
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal)
      if (!(error instanceof TypeError) || attempt >= MAX_RETRIES) throw error
      await wait(Math.min(8_000, 1_000 * 2 ** attempt), signal)
      continue
    }

    if (!retryableStatus(response.status) || attempt >= MAX_RETRIES) return response
    const delay = retryDelay(response, attempt)
    await response.body?.cancel().catch(() => undefined)
    await wait(delay, signal)
  }
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new QueridoDiarioAdapterError('capacity', 'Querido Diário page exceeded the response size limit')
  }
  if (!response.body) throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an empty page')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    totalBytes += value.byteLength
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new QueridoDiarioAdapterError('capacity', 'Querido Diário page exceeded the response size limit')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    if (error instanceof QueridoDiarioAdapterError) throw error
    throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned invalid JSON')
  }
}

export async function fetchQueridoDiario(
  source: NewsSource,
  signal?: AbortSignal,
  dependencies: QueridoDiarioDependencies = {},
): Promise<QueridoDiarioResult> {
  const baseUrl = getConfiguredUrl(source)
  const now = dependencies.now?.() ?? new Date()
  const startDate = configuredStartDate(baseUrl, source.last_fetched_at ?? null, now)
  const baseParameters = new URLSearchParams(baseUrl.searchParams)
  const fetchImpl = dependencies.fetch ?? fetch
  const wait = dependencies.wait ?? abortableDelay
  const entries: SourceEntry[] = []
  let expectedTotal: number | null = null
  let offset = 0
  let pages = 0

  while (expectedTotal === null || offset < expectedTotal) {
    signal?.throwIfAborted()
    if (pages >= MAX_PAGES_PER_RUN) {
      throw new QueridoDiarioAdapterError('capacity', `Querido Diário search exceeded ${MAX_PAGES_PER_RUN} pages; narrow the query or split the coverage`)
    }

    const url = new URL(baseUrl)
    url.search = ''
    for (const [key, value] of baseParameters.entries()) url.searchParams.append(key, value)
    url.searchParams.delete('published_since')
    url.searchParams.delete('published_until')
    url.searchParams.delete('scraped_since')
    url.searchParams.delete('scraped_until')
    url.searchParams.delete('size')
    url.searchParams.delete('offset')
    url.searchParams.delete('sort_by')
    url.searchParams.set('scraped_since', formatDateTime(startDate))
    url.searchParams.set('scraped_until', formatDateTime(now))
    url.searchParams.set('size', String(PAGE_SIZE))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('sort_by', 'descending_date')

    const response = await requestPage(fetchImpl, url, signal, wait)
    if (response.status === 304) {
      if (pages !== 0 || expectedTotal !== null) {
        throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned 304 after pagination had started')
      }
      return { entries: [], etag: null, lastModified: null, notModified: true, pages: 0 }
    }
    if (!response.ok) {
      throw new QueridoDiarioAdapterError('http', `Querido Diário returned HTTP ${response.status}`)
    }

    const page = parseGazettePage(await readJsonWithLimit(response))
    if (expectedTotal === null) expectedTotal = page.total_gazettes
    else if (expectedTotal !== page.total_gazettes) {
      throw new QueridoDiarioAdapterError('protocol', 'Querido Diário result count changed during pagination')
    }
    if (page.gazettes.length === 0 && offset < expectedTotal) {
      throw new QueridoDiarioAdapterError('protocol', 'Querido Diário returned an empty page before the result count was reached')
    }

    entries.push(...parseQueridoDiarioPage({ total_gazettes: page.total_gazettes, gazettes: page.gazettes }).entries)
    offset += page.gazettes.length
    pages++
    if (offset < expectedTotal) await wait(PAGE_INTERVAL_MS, signal)
  }

  return { entries, etag: null, lastModified: null, notModified: false, pages }
}

import { createHash } from 'node:crypto'
import { RADAR_SOURCE_DEFINITIONS, parseArticleDetails, type ArticleDetails, type RadarSourceDefinition } from './sources.js'
import type { NewsSource } from './index.js'

export const ARTICLE_DETAILS_PARSER_VERSION = 'article-details-v1'
const MAX_ARTICLE_RESPONSE_BYTES = 4 * 1024 * 1024
const MAX_ARTICLE_CONTENT_CHARS = 60_000
const MAX_REDIRECTS = 3

export interface ArticleDetailsTarget {
  url: string
  title: string
  etag: string | null
  lastModified: string | null
}

export type ArticleDetailsFetchResult =
  | {
      ok: true
      status: 200
      notModified: false
      details: ArticleDetails
      contentHash: string
      parserVersion: string
      etag: string | null
      lastModified: string | null
    }
  | {
      ok: true
      status: 304
      notModified: true
      etag: string | null
      lastModified: string | null
    }
  | { ok: false; status: number; failureCode: string }

function allowedArticleUrl(source: NewsSource, url: URL): boolean {
  try {
    const sourceOrigin = new URL(source.url)
    return url.protocol === 'https:' &&
      !url.username && !url.password &&
      url.origin === sourceOrigin.origin
  } catch {
    return false
  }
}

async function readLimitedResponse(response: Response, limit: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error('response_too_large')
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
      throw new Error('response_too_large')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, total)
}

function hashDetails(details: ArticleDetails): string {
  return createHash('sha256').update(JSON.stringify({
    title: details.title,
    publishedAt: details.publishedAt,
    content: details.content,
    attachments: details.attachments,
  })).digest('hex')
}

function normalizeDetails(
  sourceDefinition: RadarSourceDefinition,
  html: string,
  fallbackTitle: string,
): ArticleDetails {
  const parsed = parseArticleDetails(sourceDefinition, html, fallbackTitle)
  const publishedAt = parsed.publishedAt && !Number.isNaN(Date.parse(parsed.publishedAt))
    ? new Date(parsed.publishedAt).toISOString()
    : null
  const sourceOrigin = new URL(sourceDefinition.url).origin
  const attachments = [...new Set(parsed.attachments.flatMap(value => {
    try {
      const url = new URL(value)
      return url.origin === sourceOrigin && !url.username && !url.password ? [url.toString()] : []
    } catch {
      return []
    }
  }))]

  return {
    title: parsed.title?.trim() || fallbackTitle,
    publishedAt,
    content: parsed.content?.trim().slice(0, MAX_ARTICLE_CONTENT_CHARS) || null,
    attachments,
  }
}

export async function fetchArticleDetails(
  source: NewsSource,
  target: ArticleDetailsTarget,
  signal?: AbortSignal,
): Promise<ArticleDetailsFetchResult> {
  const sourceDefinition = RADAR_SOURCE_DEFINITIONS.find(definition => definition.portal === source.portal)
  if (source.source_type !== 'html' || !sourceDefinition) {
    return { ok: false, status: 0, failureCode: 'unsupported_source' }
  }

  let currentUrl: URL
  try {
    currentUrl = new URL(target.url)
  } catch {
    return { ok: false, status: 0, failureCode: 'invalid_article_url' }
  }
  if (!allowedArticleUrl(source, currentUrl)) {
    return { ok: false, status: 0, failureCode: 'article_url_outside_source_origin' }
  }

  const headers: Record<string, string> = {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': 'PlataformaNewsRadar/1.0',
  }
  if (target.etag) headers['If-None-Match'] = target.etag
  if (target.lastModified) headers['If-Modified-Since'] = target.lastModified

  try {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000)

    let response: Response | null = null
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      response = await fetch(currentUrl, { headers, redirect: 'manual', signal: requestSignal })
      if (![301, 302, 303, 307, 308].includes(response.status)) break

      const location = response.headers.get('location')
      await response.body?.cancel().catch(() => undefined)
      if (!location || redirects === MAX_REDIRECTS) {
        return { ok: false, status: response.status, failureCode: 'redirect_limit_or_missing_location' }
      }
      let nextUrl: URL
      try {
        nextUrl = new URL(location, currentUrl)
      } catch {
        return { ok: false, status: response.status, failureCode: 'invalid_redirect_location' }
      }
      if (!allowedArticleUrl(source, nextUrl)) {
        return { ok: false, status: response.status, failureCode: 'redirect_outside_source_origin' }
      }
      currentUrl = nextUrl
    }

    if (!response) return { ok: false, status: 0, failureCode: 'missing_response' }
    if (response.status === 304) {
      return {
        ok: true,
        status: 304,
        notModified: true,
        etag: response.headers.get('etag') ?? target.etag,
        lastModified: response.headers.get('last-modified') ?? target.lastModified,
      }
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined)
      return { ok: false, status: response.status, failureCode: 'unexpected_http_status' }
    }

    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      await response.body?.cancel().catch(() => undefined)
      return { ok: false, status: response.status, failureCode: 'unexpected_content_type' }
    }

    const html = new TextDecoder('utf-8').decode(await readLimitedResponse(response, MAX_ARTICLE_RESPONSE_BYTES))
    const details = normalizeDetails(sourceDefinition, html, target.title)
    return {
      ok: true,
      status: 200,
      notModified: false,
      details,
      contentHash: hashDetails(details),
      parserVersion: ARTICLE_DETAILS_PARSER_VERSION,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error
    const failureCode = error instanceof Error && error.message === 'response_too_large'
      ? 'response_too_large'
      : error instanceof Error && error.name === 'TimeoutError'
        ? 'request_timeout'
        : 'network_error'
    return { ok: false, status: 0, failureCode }
  }
}

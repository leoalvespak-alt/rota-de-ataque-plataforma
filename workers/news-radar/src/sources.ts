export type RadarSourceType = 'rss' | 'atom' | 'html'

export interface RadarSourceDefinition {
  id: string
  name: string
  url: string
  feedUrl: string | null
  sitemapUrl: string | null
  sourceType: RadarSourceType
  portal: string
  rationale: string
}

/**
 * The radar deliberately has exactly three non-official specialist portals.
 * The source list is kept in code so a deployment cannot silently broaden the
 * collection surface. RSS/Atom can be added per source without changing the
 * collection pipeline; the current public feeds are HTML pages.
 */
export const RADAR_SOURCE_DEFINITIONS: readonly RadarSourceDefinition[] = [
  {
    id: 'pci-concursos',
    name: 'PCI Concursos',
    url: 'https://www.pciconcursos.com.br/noticias',
    feedUrl: null,
    // This sitemap exposes URLs and lastmod only; current titles come from the HTML list.
    sitemapUrl: null,
    sourceType: 'html',
    portal: 'pci-concursos',
    rationale: 'atualização diária, grande cobertura nacional e carreira policial',
  },
  {
    id: 'ache-concursos',
    name: 'Ache Concursos',
    url: 'https://www.acheconcursos.com.br/noticias',
    feedUrl: null,
    sitemapUrl: 'https://www.acheconcursos.com.br/sm-news.xml',
    sourceType: 'html',
    portal: 'ache-concursos',
    rationale: 'cobertura recorrente de editais, concursos previstos e segurança pública',
  },
  {
    id: 'folha-qconcursos',
    name: 'Folha Dirigida por Qconcursos',
    url: 'https://folha.qconcursos.com/',
    feedUrl: null,
    sitemapUrl: 'https://folha.qconcursos.com/daily_sitemap.xml.gz',
    sourceType: 'html',
    portal: 'folha-qconcursos',
    rationale: 'jornalismo especializado ativo, com editorias federais e policiais',
  },
] as const

export interface SourceEntry {
  title: string
  link: string
  guid: string
  publishedAt: string | null
  description: string | null
  content?: string | null
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function cleanText(value: string): string {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
  return decodeEntities(withoutCdata.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function tagValue(block: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)
  return match?.[1] ? cleanText(match[1]) : ''
}

function linkValue(block: string): string {
  const atom = /<link(?:\s[^>]*)?\s+href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i.exec(block)
  return decodeEntities(atom?.[1] ?? tagValue(block, 'link'))
}

export function parseFeed(xml: string): SourceEntry[] {
  const entries: SourceEntry[] = []
  const blockRegex = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[2] ?? ''
    const title = tagValue(block, 'title')
    const link = linkValue(block)
    const guid = tagValue(block, 'guid') || tagValue(block, 'id') || link
    const publishedAt = tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated') || null
    const description = tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content:encoded') || null
    if (title && link) entries.push({ title, link, guid, publishedAt, description })
  }
  return entries
}

export function parseSitemap(source: RadarSourceDefinition, xml: string): SourceEntry[] {
  if (/<sitemapindex(?:\s[^>]*)?>/i.test(xml)) {
    throw new Error('Sitemap index requires child-sitemap traversal')
  }

  const entries: SourceEntry[] = []
  const seen = new Set<string>()
  const urlRegex = /<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/gi
  let match: RegExpExecArray | null
  while ((match = urlRegex.exec(xml)) !== null) {
    const block = match[1] ?? ''
    const link = tagValue(block, 'loc')
    if (!link) continue
    let canonicalLink: string
    try {
      const parsedLink = new URL(link, source.url)
      if (!['http:', 'https:'].includes(parsedLink.protocol) || parsedLink.hostname !== new URL(source.url).hostname) continue
      canonicalLink = parsedLink.toString()
    } catch {
      continue
    }
    if (seen.has(canonicalLink)) continue

    const news = /<news:news(?:\s[^>]*)?>([\s\S]*?)<\/news:news>/i.exec(block)?.[1]
    if (!news) continue
    const title = tagValue(news, 'news:title') || tagValue(news, 'title')
    const publishedAt = tagValue(news, 'news:publication_date') || null
    if (!title) continue
    seen.add(canonicalLink)
    entries.push({ title, link: canonicalLink, guid: canonicalLink, publishedAt, description: null })
  }
  return entries
}

export interface ArticleDetails {
  title: string | null
  publishedAt: string | null
  content: string | null
  attachments: string[]
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attributeRegex = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let match: RegExpExecArray | null
  while ((match = attributeRegex.exec(tag)) !== null) {
    const name = (match[1] ?? '').toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attributes[name] = decodeEntities(value)
  }
  return attributes
}

function extractMetaContent(html: string, names: string[]): string | null {
  const tagRegex = /<meta\b[^>]*>/gi
  const acceptedNames = new Set(names.map(name => name.toLowerCase()))
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(html)) !== null) {
    const attributes = parseAttributes(match[0])
    const marker = attributes.property ?? attributes.name ?? attributes.itemprop
    if (marker && acceptedNames.has(marker.toLowerCase()) && attributes.content) return attributes.content
  }
  return null
}

function extractElementContent(html: string, matches: (tag: string, attributes: Record<string, string>) => boolean): string | null {
  const openingTagRegex = /<([a-z][\w:-]*)\b[^>]*>/gi
  let opening: RegExpExecArray | null
  while ((opening = openingTagRegex.exec(html)) !== null) {
    const tag = (opening[1] ?? '').toLowerCase()
    const rawTag = opening[0]
    if (!matches(tag, parseAttributes(rawTag))) continue

    const contentStart = opening.index + rawTag.length
    const tagRegex = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi')
    tagRegex.lastIndex = contentStart
    let depth = 1
    let current: RegExpExecArray | null
    while ((current = tagRegex.exec(html)) !== null) {
      const token = current[0]
      if (/^<\//.test(token)) depth--
      else if (!/\/\s*>$/.test(token)) depth++
      if (depth === 0) {
        const content = html.slice(contentStart, current.index)
        if (content.trim()) return content
        break
      }
    }
    return null
  }
  return null
}

function extractPublishedDate(html: string): string | null {
  const verifiedDate = (value: string | undefined): string | null =>
    value && !Number.isNaN(Date.parse(value)) ? value : null

  const tagRegex = /<(meta|time)\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0]
    const attributes = parseAttributes(tag)
    const marker = `${attributes.property ?? ''} ${attributes.name ?? ''} ${attributes.itemprop ?? ''}`.toLowerCase()
    if (/(article:published_time|datepublished|publication_date)/.test(marker) && attributes.content) {
      const date = verifiedDate(attributes.content)
      if (date) return date
    }
    if ((match[1] ?? '').toLowerCase() === 'time' && attributes.datetime) {
      const date = verifiedDate(attributes.datetime)
      if (date) return date
    }
  }

  const jsonLdDate = /["']datePublished["']\s*:\s*["']([^"']+)["']/i.exec(html)?.[1]
  return verifiedDate(jsonLdDate)
}

function articleBodySelector(source: RadarSourceDefinition): (tag: string, attributes: Record<string, string>) => boolean {
  if (source.portal === 'pci-concursos') {
    return (_tag, attributes) => (attributes.itemprop ?? '').split(/\s+/).includes('articleBody')
  }
  if (source.portal === 'ache-concursos') {
    return (_tag, attributes) => (attributes.class ?? '').split(/\s+/).includes('post-content')
  }
  return (tag, attributes) => tag === 'article' && attributes.id === 'article-content'
}

export function parseArticleDetails(source: RadarSourceDefinition, html: string, fallbackTitle?: string): ArticleDetails {
  const title = extractElementContent(html, (tag, attributes) => tag === 'h1' && !/logo|menu|nav|header/i.test(`${attributes.id ?? ''} ${attributes.class ?? ''}`))
    ?? extractElementContent(html, (tag, attributes) => /^h[2-3]$/.test(tag) && !/menu|nav|header/i.test(`${attributes.id ?? ''} ${attributes.class ?? ''}`))
    ?? extractMetaContent(html, ['og:title', 'twitter:title', 'headline', 'article:headline'])
    ?? extractElementContent(html, tag => tag === 'title')
    ?? fallbackTitle
    ?? extractElementContent(html, (_tag, attributes) => attributes.property === 'og:title')
  const bodyHtml = extractElementContent(html, articleBodySelector(source))
  const content = bodyHtml
    ?.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\b[^>]*>|<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
  const cleanContent = content ? cleanText(content) : null
  const attachments: string[] = []
  if (bodyHtml) {
    const linkRegex = /<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>/gi
    let linkMatch: RegExpExecArray | null
    const allowedHost = new URL(source.url).hostname
    while ((linkMatch = linkRegex.exec(bodyHtml)) !== null) {
      try {
        const attachment = new URL(decodeEntities(linkMatch[1] ?? ''), source.url)
        if (attachment.hostname !== allowedHost || attachment.protocol !== 'https:') continue
        if (!attachments.includes(attachment.toString())) attachments.push(attachment.toString())
      } catch {
        // Invalid attachment links are ignored; the article itself remains usable.
      }
    }
  }

  return {
    title: title ? cleanText(title) || null : null,
    publishedAt: extractPublishedDate(html),
    content: cleanContent && cleanContent.length > 0 ? cleanContent : null,
    attachments,
  }
}

function looksLikeArticle(source: RadarSourceDefinition, href: string): boolean {
  try {
    const url = new URL(href, source.url)
    if (url.hostname !== new URL(source.url).hostname) return false
    const path = url.pathname.toLowerCase()
    if (source.portal === 'pci-concursos' || source.portal === 'ache-concursos') {
      return /^\/noticias\/[^/]+$/.test(path)
    }
    return /^\/n\/[^/]+$/.test(path)
  } catch {
    return false
  }
}

export function parseHtml(source: RadarSourceDefinition, html: string): SourceEntry[] {
  const entries: SourceEntry[] = []
  const seen = new Set<string>()
  const anchorRegex = /<a(?:\s[^>]*)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html)) !== null) {
    const link = new URL(decodeEntities(match[1] ?? ''), source.url).toString()
    if (!looksLikeArticle(source, link)) continue
    const anchorContent = match[2] ?? ''
    const title = tagValue(anchorContent, 'h1')
      || tagValue(anchorContent, 'h2')
      || tagValue(anchorContent, 'h3')
      || cleanText(anchorContent)
    if (title.length < 18 || seen.has(link)) continue
    seen.add(link)
    entries.push({ title, link, guid: link, publishedAt: null, description: null })
  }
  return entries
}

export function nextHtmlPaginationUrl(source: RadarSourceDefinition, html: string, currentUrl: string): string | null {
  if (source.portal !== 'pci-concursos') return null

  let origin: URL
  let current: URL
  try {
    origin = new URL(source.url)
    current = new URL(currentUrl, origin)
  } catch {
    return null
  }
  if (origin.protocol !== 'https:' || current.origin !== origin.origin || current.search || current.hash) return null

  const currentPath = current.pathname.replace(/\/$/, '')
  const pageMatch = /^\/noticias\/(\d+)$/.exec(currentPath)
  if (currentPath !== '/noticias' && !pageMatch) return null
  const currentPage = pageMatch ? Number(pageMatch[1]) : 0
  const candidates: Array<{ url: URL; page: number; next: boolean }> = []
  const anchorRegex = /<a\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html)) !== null) {
    const attributes = parseAttributes(match[0])
    if (!(attributes.class ?? '').split(/\s+/).includes('page-link')) continue
    if (!attributes.href) continue

    try {
      const url = new URL(attributes.href, current)
      if (url.protocol !== 'https:' || url.origin !== origin.origin || url.search || url.hash || url.username || url.password) continue
      const path = url.pathname.replace(/\/$/, '')
      const candidateMatch = /^\/noticias\/(\d+)$/.exec(path)
      if (!candidateMatch) continue
      const page = Number(candidateMatch[1])
      if (!Number.isSafeInteger(page) || page <= currentPage) continue
      const label = `${attributes.rel ?? ''} ${attributes['aria-label'] ?? ''} ${attributes.title ?? ''}`.toLowerCase()
      candidates.push({ url, page, next: /(?:next|pr[oó]xima|seguinte)/i.test(label) })
    } catch {
      // A malformed or external navigation link cannot extend this source scan.
    }
  }

  const next = candidates.find(candidate => candidate.next)
    ?? candidates.sort((left, right) => left.page - right.page)[0]
  return next?.url.href ?? null
}

export function normalizeSourceEntry(entry: SourceEntry): SourceEntry {
  let link = entry.link
  try {
    const url = new URL(entry.link)
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid']) url.searchParams.delete(key)
    url.hash = ''
    link = url.toString()
  } catch {
    // Invalid links are rejected by the caller's URL hash/dedup gate.
  }
  const publishedAt = entry.publishedAt && !Number.isNaN(Date.parse(entry.publishedAt)) ? entry.publishedAt : null
  return { ...entry, link, title: cleanText(entry.title), description: entry.description ? cleanText(entry.description) : null, publishedAt }
}

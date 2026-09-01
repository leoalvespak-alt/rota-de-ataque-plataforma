export type RadarSourceType = 'rss' | 'atom' | 'html'

export interface RadarSourceDefinition {
  id: string
  name: string
  url: string
  feedUrl: string | null
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
    sourceType: 'html',
    portal: 'pci-concursos',
    rationale: 'atualização diária, grande cobertura nacional e carreira policial',
  },
  {
    id: 'ache-concursos',
    name: 'Ache Concursos',
    url: 'https://www.acheconcursos.com.br/noticias',
    feedUrl: null,
    sourceType: 'html',
    portal: 'ache-concursos',
    rationale: 'cobertura recorrente de editais, concursos previstos e segurança pública',
  },
  {
    id: 'folha-qconcursos',
    name: 'Folha Dirigida por Qconcursos',
    url: 'https://folha.qconcursos.com/',
    feedUrl: null,
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
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
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

function looksLikeArticle(source: RadarSourceDefinition, href: string): boolean {
  try {
    const url = new URL(href, source.url)
    if (url.hostname !== new URL(source.url).hostname) return false
    const path = url.pathname.toLowerCase()
    if (source.portal === 'pci-concursos') return path.includes('/noticias/') || path.includes('/concursos/')
    if (source.portal === 'ache-concursos') return path.includes('/noticias/')
    return path.includes('/n/') || /\/(concurso|concursos|policia|policial|seguranca)/i.test(path)
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
    const title = cleanText(match[2] ?? '')
    if (title.length < 18 || seen.has(link)) continue
    seen.add(link)
    entries.push({ title, link, guid: link, publishedAt: null, description: null })
  }
  return entries
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
  return { ...entry, link, title: cleanText(entry.title), description: entry.description ? cleanText(entry.description) : null }
}

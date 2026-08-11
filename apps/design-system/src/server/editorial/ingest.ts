import { createHash } from 'node:crypto'

export type ChunkInput = { content: string; title?: string | null; sectionPath?: string | null; chunkType: 'heading' | 'paragraph' | 'list' | 'quote' | 'section'; chunkIndex: number; tokenCount: number; hash: string }
export const normalizeText = (text: string) => text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
export const contentHash = (text: string) => createHash('sha256').update(text).digest('hex')
export const wordCount = (text: string) => normalizeText(text).split(/\s+/).filter(Boolean).length

/** Splits at paragraph boundaries and preserves Markdown headings/lists whenever possible. */
export function chunkDocument(source: string, options: { maxTokens?: number; overlapTokens?: number } = {}): ChunkInput[] {
  const maxTokens = options.maxTokens ?? 500; const overlapTokens = options.overlapTokens ?? Math.round(maxTokens * 0.12)
  const blocks = normalizeText(source).split(/\n\s*\n/).filter(Boolean)
  const chunks: ChunkInput[] = []; let buffer: string[] = []; let tokens = 0; let heading: string | null = null
  const flush = () => { if (!buffer.length) return; const content = buffer.join('\n\n'); chunks.push({ content, title: heading, sectionPath: heading, chunkType: content.startsWith('>') ? 'quote' : /^[-*•]\s/m.test(content) ? 'list' : heading ? 'section' : 'paragraph', chunkIndex: chunks.length, tokenCount: tokens, hash: contentHash(content) }); const tail = content.split(/\s+/).slice(-overlapTokens).join(' '); buffer = tail ? [tail] : []; tokens = tail ? overlapTokens : 0 }
  for (const block of blocks) { if (/^#{1,6}\s+/.test(block)) heading = block.replace(/^#+\s*/, ''); const blockTokens = wordCount(block); if (tokens && tokens + blockTokens > maxTokens) flush(); buffer.push(block); tokens += blockTokens }
  flush(); return chunks
}

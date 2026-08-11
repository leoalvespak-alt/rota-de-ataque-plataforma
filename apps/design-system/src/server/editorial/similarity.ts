import type { SimilarityResult } from '@/domain/editorial/types'

const tokenize = (text: string) => text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) ?? []
const setRatio = (a: string[], b: string[]) => { const x = new Set(a); const y = new Set(b); const union = new Set([...x, ...y]).size; return union ? [...x].filter((v) => y.has(v)).length / union : 0 }
const grams = (tokens: string[], size: number) => tokens.slice(0, -(size - 1)).map((_, i) => tokens.slice(i, i + size).join(' '))
export const cosineSimilarity = (a: number[], b: number[]) => { if (!a.length || a.length !== b.length) return 0; let dot = 0, ma = 0, mb = 0; for (let i = 0; i < a.length; i += 1) { dot += a[i]! * b[i]!; ma += a[i]! ** 2; mb += b[i]! ** 2 } return ma && mb ? dot / Math.sqrt(ma * mb) : 0 }
export function compareContent(current: { title?: string; hook?: string; text: string; embedding?: number[] }, previous: { title?: string; hook?: string; text: string; embedding?: number[] }): SimilarityResult {
  const currentTokens = tokenize(current.text); const previousTokens = tokenize(previous.text); const lexical = setRatio(currentTokens, previousTokens); const ngram = Math.max(setRatio(grams(currentTokens, 2), grams(previousTokens, 2)), setRatio(grams(currentTokens, 3), grams(previousTokens, 3))); const semantic = current.embedding && previous.embedding ? cosineSimilarity(current.embedding, previous.embedding) : lexical
  const title = setRatio(tokenize(current.title ?? ''), tokenize(previous.title ?? '')); const hook = setRatio(tokenize(current.hook ?? ''), tokenize(previous.hook ?? '')); const maximum = Math.max(semantic, lexical, ngram, title, hook)
  return { semantic, lexical, ngram, title, hook, decision: maximum > .86 || title > .9 || hook > .92 ? 'block' : maximum >= .78 ? 'review' : 'pass' }
}

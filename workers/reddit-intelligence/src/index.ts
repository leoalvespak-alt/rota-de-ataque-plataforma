import { createHash } from 'node:crypto'
import type { RedditThing } from '@plataforma/reddit-api'
import { createWorker, type WorkerJob, type WorkerResult, type WorkerSpec } from '@plataforma/shared/worker'

export const spec = { queue: 'reddit-intelligence', requiresMetaToken: false } satisfies WorkerSpec
export interface RedditPayload { watchId?: string }
export interface RedditWatch { id: string; campaignId: string; kind: 'subreddit' | 'search_query' | 'user' | 'keyword_across'; value: string; minIntervalSeconds: number; maxIntervalSeconds: number }
export interface RedditSource { collect(watch: RedditWatch): Promise<RedditThing[]> }
export interface RedditRepository { due(watchId?: string): Promise<RedditWatch[]>; save(watch: RedditWatch, item: RedditThing, text: string, authorHash: string | null, embedding: number[]): Promise<boolean>; schedule(watch: RedditWatch, produced: number): Promise<void>; upsertSignal(watch: RedditWatch, item: RedditThing, text: string): Promise<void> }
export interface Embedder { embed(text: string): Promise<number[]> }

export function redditText(item: RedditThing) { return [item.title, item.selftext, item.body].filter(Boolean).join('\n').trim() }
export const hashRedditAuthor = (author: string | undefined, salt: string) => author ? createHash('sha256').update(`${salt}:${author.toLowerCase()}`).digest('hex') : null

export function createRedditProcessor(repository: RedditRepository, source: RedditSource, embedder: Embedder, salt: string) {
  const gate = createWorker<RedditPayload>(spec)
  return async (job: WorkerJob<RedditPayload>): Promise<WorkerResult> => {
    const base = await gate(job); let collected = 0
    for (const watch of await repository.due(job.payload.watchId)) {
      const items = await source.collect(watch)
      for (const item of items) {
        const text = redditText(item); if (!text) continue
        const inserted = await repository.save(watch, item, text, hashRedditAuthor(item.author, salt), await embedder.embed(text))
        if (inserted) { collected += 1; await repository.upsertSignal(watch, item, text) }
      }
      await repository.schedule(watch, items.length)
    }
    return { ...base, event: { kind: 'reddit-intelligence.completed', payload: { collected } } }
  }
}

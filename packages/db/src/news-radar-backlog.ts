import type { Pool } from 'pg'

export interface NewsRadarBacklog {
  eligible: number
  undated: number
  stale: number
  future: number
}

// Keep the eligible predicate aligned with the classifier selection. Unknown
// publication dates must never be replaced by fetch dates for historical items.
export async function readNewsRadarBacklog(pool: Pick<Pool, 'query'>): Promise<NewsRadarBacklog> {
  const result = await pool.query<NewsRadarBacklog>(`SELECT
    count(*) FILTER (WHERE published_at >= now() - interval '30 days' AND published_at <= now())::int eligible,
    count(*) FILTER (WHERE published_at IS NULL)::int undated,
    count(*) FILTER (WHERE published_at < now() - interval '30 days')::int stale,
    count(*) FILTER (WHERE published_at > now())::int future
    FROM public.news_items WHERE classified = false`)
  return result.rows[0]!
}

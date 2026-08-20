import type { Pool } from 'pg'

export interface CompetitorProfile {
  id: string
  handle: string
  platform: string
  display_name: string
}

export interface MediaPost {
  id: string
  caption: string | null
  comments_count: number
  like_count: number
  media_type: string
  permalink: string
  timestamp: string
}

export interface CompetitorAnalysis {
  competitor: CompetitorProfile
  followers_count: number
  media_count: number
  posts: MediaPost[]
  format_distribution: Record<string, number>
  median_engagement: Record<string, number>
  outliers: MediaPost[]
  top_hooks: string[]
  posting_hours: number[]
}

function extractHook(caption: string | null): string | null {
  if (!caption) return null
  const firstLine = caption.split('\n')[0]?.trim() ?? ''
  return firstLine.length > 10 && firstLine.length < 200 ? firstLine : null
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function analyzeCompetitor(competitor: CompetitorProfile, followers: number, mediaCount: number, posts: MediaPost[]): CompetitorAnalysis {
  const formatDist: Record<string, number> = {}
  const engagementByFormat: Record<string, number[]> = {}
  const hooks: string[] = []
  const hours: number[] = []

  for (const post of posts) {
    const format = post.media_type === 'VIDEO' ? 'reels' : post.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'image'
    formatDist[format] = (formatDist[format] ?? 0) + 1
    const engagement = post.like_count + post.comments_count
    if (!engagementByFormat[format]) engagementByFormat[format] = []
    engagementByFormat[format].push(engagement)

    const hook = extractHook(post.caption)
    if (hook) hooks.push(hook)

    try {
      const hour = new Date(post.timestamp).getHours()
      hours.push(hour)
    } catch {}
  }

  const medianEngagement: Record<string, number> = {}
  for (const [format, values] of Object.entries(engagementByFormat)) {
    medianEngagement[format] = median(values)
  }

  const overallMedian = median(posts.map(p => p.like_count + p.comments_count))
  const outliers = posts.filter(p => {
    const engagement = p.like_count + p.comments_count
    return overallMedian > 0 && engagement >= overallMedian * 3
  })

  return {
    competitor,
    followers_count: followers,
    media_count: mediaCount,
    posts,
    format_distribution: formatDist,
    median_engagement: medianEngagement,
    outliers,
    top_hooks: hooks.slice(0, 10),
    posting_hours: hours,
  }
}

export async function runCompetitorIntelligence(
  pool: Pool,
  metaClient: { businessDiscovery: (userId: string, username: string, limit?: number) => Promise<any> } | null,
  igUserId: string | null,
  ai: { complete: (prompt: string) => Promise<string> } | null,
  windowDays: number = 7,
): Promise<{ analyzed: number; insights: number; suggestions: number }> {
  const competitors = await pool.query<CompetitorProfile>(
    "SELECT id, handle, platform, display_name FROM candidate_sources WHERE origin = 'manual' AND status = 'active' AND platform = 'instagram'"
  )

  let analyzed = 0, insights = 0, suggestions = 0

  for (const comp of competitors.rows) {
    if (!metaClient || !igUserId) continue

    try {
      const discovery = await metaClient.businessDiscovery(igUserId, comp.handle, 25)
      if (!discovery?.business_discovery) continue

      const bd = discovery.business_discovery
      const posts: MediaPost[] = (bd.media?.data ?? []).map((m: any) => ({
        id: m.id,
        caption: m.caption ?? null,
        comments_count: m.comments_count ?? 0,
        like_count: m.like_count ?? 0,
        media_type: m.media_type ?? 'IMAGE',
        permalink: m.permalink ?? '',
        timestamp: m.timestamp ?? new Date().toISOString(),
      }))

      const analysis = analyzeCompetitor(comp, bd.followers_count ?? 0, bd.media_count ?? 0, posts)

      for (const outlier of analysis.outliers) {
        const multiplier = analysis.median_engagement.reels
          ? (outlier.like_count + outlier.comments_count) / Math.max(1, median(posts.map(p => p.like_count + p.comments_count)))
          : 0

        const hook = extractHook(outlier.caption)
        const hypothesis = hook
          ? `Outlier post with hook "${hook}" — ${outlier.media_type} format, ${multiplier.toFixed(1)}x median engagement`
          : `Outlier ${outlier.media_type} post with ${multiplier.toFixed(1)}x median engagement`

        await pool.query(
          `INSERT INTO competitor_insights (competitor_source_id, competitor_handle, platform, insight_type, title, description, evidence, metrics, is_outlier, outlier_multiplier, hypothesis)
           VALUES ($1, $2, $3, 'outlier', $4, $5, $6, $7, true, $8, $9)`,
          [
            comp.id, comp.handle, comp.platform,
            `Outlier: ${comp.handle} — ${outlier.media_type}`,
            hypothesis,
            JSON.stringify({ permalink: outlier.permalink, caption: outlier.caption?.slice(0, 500), timestamp: outlier.timestamp }),
            JSON.stringify({ like_count: outlier.like_count, comments_count: outlier.comments_count, median_engagement: median(posts.map(p => p.like_count + p.comments_count)) }),
            multiplier, hypothesis,
          ]
        )
        insights++
      }

      for (const [format, count] of Object.entries(analysis.format_distribution)) {
        if (count >= 3) {
          await pool.query(
            `INSERT INTO competitor_insights (competitor_source_id, competitor_handle, platform, insight_type, title, description, evidence, metrics)
             VALUES ($1, $2, $3, 'format_trend', $4, $5, $6, $7)`,
            [
              comp.id, comp.handle, comp.platform,
              `Format trend: ${comp.handle} — ${format}`,
              `${comp.handle} posts ${count} ${format}s in recent window. Median engagement: ${analysis.median_engagement[format] ?? 0}`,
              JSON.stringify({ format, count, total_posts: posts.length }),
              JSON.stringify({ median_engagement: analysis.median_engagement[format] ?? 0, format_share: count / Math.max(1, posts.length) }),
            ]
          )
          insights++
        }
      }

      for (const hook of analysis.top_hooks.slice(0, 3)) {
        await pool.query(
          `INSERT INTO competitor_insights (competitor_source_id, competitor_handle, platform, insight_type, title, evidence)
           VALUES ($1, $2, $3, 'hook_pattern', $4, $5)`,
          [comp.id, comp.handle, comp.platform, `Hook: "${hook.slice(0, 80)}"`, JSON.stringify({ full_hook: hook, source: comp.handle })]
        )
        insights++
      }

      analyzed++
    } catch (error) {
      // Skip competitors we can't fetch
    }
  }

  if (ai && insights > 0) {
    const recentInsights = await pool.query(
      `SELECT ci.title, ci.description, ci.hypothesis, ci.competitor_handle, ci.insight_type, ci.metrics
       FROM competitor_insights ci WHERE ci.created_at > now() - interval '1 hour' AND NOT ci.processed
       ORDER BY ci.created_at DESC LIMIT 20`
    )

    if (recentInsights.rows.length > 0) {
      const pillars = await pool.query("SELECT name, slug FROM content_pillars WHERE active = true")
      const rules = await pool.query("SELECT rule_text, rule_type FROM editorial_rules WHERE active = true AND rule_type = 'dont'")

      const pillarNames = pillars.rows.map((p: any) => p.name).join(', ')
      const dontRules = rules.rows.map((r: any) => `- ${r.rule_text}`).join('\n')

      const insightSummary = recentInsights.rows.map((i: any) =>
        `[${i.insight_type}] ${i.competitor_handle}: ${i.title}${i.hypothesis ? ` — ${i.hypothesis}` : ''}`
      ).join('\n')

      try {
        const prompt = `Based on these competitor insights from police exam prep Instagram accounts, suggest 3-5 content ideas for @rotadeataque.

Insights:
${insightSummary}

Available pillars: ${pillarNames}

MUST NOT:
${dontRules}

Return JSON array with objects: { title, description, suggested_format (reels/carousel/static/threads), pillar, thesis_number (T1-T6) }`

        const response = await ai.complete(prompt)
        const suggestionList = JSON.parse(response)

        for (const s of Array.isArray(suggestionList) ? suggestionList : []) {
          await pool.query(
            `INSERT INTO content_suggestions (source_type, title, description, suggested_format, pillar, evidence, editorial_rules_validated, curation_status)
             VALUES ('competitor', $1, $2, $3, $4, $5, true, 'proposed')`,
            [s.title, s.description, s.suggested_format, s.pillar, JSON.stringify({ insights: insightSummary.slice(0, 500), thesis: s.thesis_number })]
          )
          suggestions++
        }
      } catch {}
    }

    await pool.query("UPDATE competitor_insights SET processed = true WHERE created_at > now() - interval '1 hour' AND NOT processed")
  }

  return { analyzed, insights, suggestions }
}

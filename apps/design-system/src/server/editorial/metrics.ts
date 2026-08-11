import { avg, count, eq, sql } from 'drizzle-orm'
import { contentItems, editorialTheses, generationJobs } from '@/db/editorial-schema'
import { db } from '@/server/api/db'

export async function getEditorialMetrics() {
  const [contents] = await db.select({ total: count(), approved: sql<number>`count(*) filter (where ${contentItems.status} = 'approved')::int`, rejected: sql<number>`count(*) filter (where ${contentItems.status} = 'rejected')::int`, averageQuality: avg(sql<number>`${contentItems.qualityScore}->>'overall'`) }).from(contentItems)
  const [jobs] = await db.select({ total: count(), failed: sql<number>`count(*) filter (where ${generationJobs.status} = 'failed')::int`, totalCost: sql<string>`coalesce(sum(${generationJobs.cost}), 0)` }).from(generationJobs)
  const thesisUsage = await db.select({ title: editorialTheses.title, count: count(contentItems.id) }).from(editorialTheses).leftJoin(contentItems, eq(contentItems.thesisId, editorialTheses.id)).groupBy(editorialTheses.id).orderBy(sql`count(${contentItems.id}) desc`).limit(10)
  return { contents, jobs, thesisUsage }
}

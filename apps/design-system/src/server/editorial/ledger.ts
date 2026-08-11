import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { contentUsageLedger, editorialThesisArguments } from '@/db/editorial-schema'
import { db } from '@/server/api/db'

export async function getRecentUsage(thesisId: string, days = 30) { const since = new Date(); since.setDate(since.getDate() - days); return db.select().from(contentUsageLedger).where(and(eq(contentUsageLedger.thesisId, thesisId), gte(contentUsageLedger.usedAt, since.toISOString().slice(0, 10)))).orderBy(desc(contentUsageLedger.usedAt)) }
export async function getAngleUsage(thesisId: string, month: string) { return db.select({ angleId: contentUsageLedger.angleId, count: sql<number>`count(*)::int` }).from(contentUsageLedger).where(and(eq(contentUsageLedger.thesisId, thesisId), sql`${contentUsageLedger.usedAt}::text like ${`${month}%`}`)).groupBy(contentUsageLedger.angleId) }
export async function getArgumentUsage(thesisId: string) { return db.select().from(editorialThesisArguments).where(eq(editorialThesisArguments.thesisId, thesisId)).orderBy(editorialThesisArguments.usageCount) }
export async function getTemplateUsage(lastN = 10) { return db.select({ template: contentUsageLedger.templateUsed }).from(contentUsageLedger).orderBy(desc(contentUsageLedger.createdAt)).limit(lastN) }

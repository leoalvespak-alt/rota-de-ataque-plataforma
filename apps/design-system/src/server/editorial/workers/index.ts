import { Worker, type Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import { editorialPlanItems, generationJobs } from '@/db/editorial-schema'
import { db } from '@/server/api/db'

/** Worker mínimo e idempotente: registra a etapa e deixa cada fase re-enfileirar a seguinte. */
export function createEditorialBriefWorker() { return new Worker('editorial-brief', async (job: Job<{ generationJobId: string; planId?: string }>) => { if (!job.data.planId) return; await db.update(generationJobs).set({ status: 'active', startedAt: new Date() }).where(eq(generationJobs.id, job.data.generationJobId)); await db.update(editorialPlanItems).set({ status: 'brief_generated', updatedAt: new Date() }).where(eq(editorialPlanItems.planId, job.data.planId)); await db.update(generationJobs).set({ status: 'completed', completedAt: new Date() }).where(eq(generationJobs.id, job.data.generationJobId)) }, { connection: { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) } }) }

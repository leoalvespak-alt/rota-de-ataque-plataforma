import { Worker, type Job } from 'bullmq'
import { and, count, eq, ne } from 'drizzle-orm'
import { editorialPlanItems, generationJobs } from '@/db/editorial-schema'
import { db } from '@/server/api/db'
import { getBullMQConnection } from '@/server/infra/redis'
import { getEditorialQueue } from '@/server/queue/editorialQueues'

const connection = getBullMQConnection()

export function createEditorialBriefWorker() {
  return new Worker('editorial-brief', async (job: Job<{ generationJobId: string; planId?: string }>) => {
    if (!job.data.planId) return
    await db.update(generationJobs).set({ status: 'active', startedAt: new Date() }).where(eq(generationJobs.id, job.data.generationJobId))
    await db.update(editorialPlanItems).set({ status: 'brief_generated', updatedAt: new Date() }).where(eq(editorialPlanItems.planId, job.data.planId))
    
    // Pass along to next queue for each item (mock logic)
    const items = await db.select().from(editorialPlanItems).where(eq(editorialPlanItems.planId, job.data.planId))
    for (const item of items) {
      await getEditorialQueue('editorial-copy').add('copy', { generationJobId: job.data.generationJobId, planId: job.data.planId, planItemId: item.id })
    }
  }, { connection })
}

export function createEditorialCopyWorker() {
  return new Worker('editorial-copy', async (job: Job) => {
    if (job.data.planItemId) await db.update(editorialPlanItems).set({ status: 'copy_generated', updatedAt: new Date() }).where(eq(editorialPlanItems.id, job.data.planItemId))
    await getEditorialQueue('editorial-review').add('review', job.data)
  }, { connection })
}

export function createEditorialReviewWorker() {
  return new Worker('editorial-review', async (job: Job) => {
    if (job.data.planItemId) await db.update(editorialPlanItems).set({ status: 'reviewed', updatedAt: new Date() }).where(eq(editorialPlanItems.id, job.data.planItemId))
    await getEditorialQueue('editorial-template').add('template', job.data)
  }, { connection })
}

export function createEditorialTemplateWorker() {
  return new Worker('editorial-template', async (job: Job) => {
    if (job.data.planItemId) await db.update(editorialPlanItems).set({ status: 'templated', updatedAt: new Date() }).where(eq(editorialPlanItems.id, job.data.planItemId))
    await getEditorialQueue('editorial-visual').add('visual', job.data)
  }, { connection })
}

export function createEditorialVisualWorker() {
  return new Worker('editorial-visual', async (job: Job) => {
    if (job.data.planItemId) await db.update(editorialPlanItems).set({ status: 'visual_generated', updatedAt: new Date() }).where(eq(editorialPlanItems.id, job.data.planItemId))
    await getEditorialQueue('editorial-finalize').add('finalize', job.data)
  }, { connection })
}

export function createEditorialFinalizeWorker() {
  return new Worker('editorial-finalize', async (job: Job) => {
    if (job.data.planItemId) {
      await db.update(editorialPlanItems).set({ status: 'ready_for_approval', updatedAt: new Date() }).where(eq(editorialPlanItems.id, job.data.planItemId))
    }
    if (job.data.planId) {
      const [pending] = await db.select({ count: count() }).from(editorialPlanItems)
        .where(and(eq(editorialPlanItems.planId, job.data.planId), ne(editorialPlanItems.status, 'ready_for_approval')))
      if ((pending?.count ?? 1) === 0) {
        await db.update(generationJobs).set({ status: 'completed', completedAt: new Date() }).where(eq(generationJobs.id, job.data.generationJobId))
      }
    }
  }, { connection })
}

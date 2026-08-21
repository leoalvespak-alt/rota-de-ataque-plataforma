import { db } from '../apps/design-system/src/server/api/db'
import { editorialPlanItems, contentItems, editorialPlans, generationJobs } from '../apps/design-system/src/db/editorial-schema'
import { creativeProjects } from '../apps/design-system/src/db/schema'
import { eq } from 'drizzle-orm'

async function inspect() {
  console.log("=== contentItems ===")
  const items = await db.select().from(contentItems)
  console.log("contentItems count:", items.length)
  if (items.length > 0) {
    console.log("Sample:", items[0])
    console.log("Statuses:", items.map(i => i.status).reduce((acc, s) => ({...acc, [s]: (acc[s]||0)+1}), {} as Record<string, number>))
  }

  console.log("=== editorialPlanItems ===")
  const planItems = await db.select().from(editorialPlanItems)
  console.log("editorialPlanItems count:", planItems.length)

  console.log("=== creativeProjects ===")
  const projects = await db.select().from(creativeProjects)
  console.log("creativeProjects count:", projects.length)
  if (projects.length > 0) {
    console.log("Projects:", projects.map(p => ({ id: p.id, title: p.title, status: p.status })))
  }
}
inspect().catch(console.error).finally(() => process.exit(0))

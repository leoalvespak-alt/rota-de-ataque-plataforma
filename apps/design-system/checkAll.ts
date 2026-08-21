import { db } from '@/server/api/db'
import { creativeProjects } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function checkAll() {
  const projects = await db.select().from(creativeProjects)
  
  for (const p of projects) {
    if (p.status !== 'em_andamento') {
      await db.update(creativeProjects).set({ status: 'em_andamento' }).where(eq(creativeProjects.id, p.id))
      console.log(`Updated ${p.id} to em_andamento`)
    }
  }
  process.exit(0)
}
checkAll().catch(e => { console.error(e); process.exit(1) })

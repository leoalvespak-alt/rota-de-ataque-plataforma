import { db } from '@/server/api/db'
import { creativeProjects } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function check() {
  const projects = await db.select().from(creativeProjects).where(eq(creativeProjects.status, 'finalizado'))
  console.log(`Encontrados ${projects.length} projetos 'finalizados'`)
  if (projects.length > 0) {
    for (const p of projects) {
      await db.update(creativeProjects).set({ status: 'em_andamento' }).where(eq(creativeProjects.id, p.id))
    }
    console.log("Projetos revertidos para 'em_andamento'")
  }
  process.exit(0)
}
check().catch(e => { console.error(e); process.exit(1) })

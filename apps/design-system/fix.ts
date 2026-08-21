import { db } from '@/server/api/db'
import { contentItems, editorialPlanItems } from '@/db/editorial-schema'
import { creativeProjects, users } from '@/db/schema'
import { eq, or, sql } from 'drizzle-orm'

async function fix() {
  console.log('Iniciando correção dos posts aprovados pelo Codex...')
  const allUsers = await db.select().from(users).limit(1)
  if (allUsers.length === 0) { console.error('Nenhum usuário encontrado.'); return }
  const userId = allUsers[0].id

  const items = await db.select({
    id: contentItems.id,
    format: contentItems.format,
    status: contentItems.status,
    copyData: contentItems.copyData,
    planItemId: contentItems.planItemId,
    templateId: contentItems.templateId,
    scheduledDate: editorialPlanItems.scheduledDate,
  }).from(contentItems).leftJoin(editorialPlanItems, eq(contentItems.planItemId, editorialPlanItems.id))
  .where(or(eq(contentItems.status, 'approved'), eq(contentItems.status, 'ready_for_approval')))

  console.log(`Encontrados ${items.length} itens...`)
  let updated = 0, inserted = 0

  for (const item of items) {
    if (item.status === 'approved') {
      await db.update(contentItems).set({ status: 'ready_for_approval' }).where(eq(contentItems.id, item.id))
      updated++
    }
    const existing = await db.select().from(creativeProjects).where(sql`metadata->>'contentItemId' = ${item.id}`)
    if (existing.length === 0) {
      const copy = item.copyData as any || {}
      const title = copy.headline || `Criativo ${item.format} - ${item.scheduledDate || 'Sem data'}`
      const wizardData = {
        step: 4,
        creativeType: item.format === 'story' ? 'story' : (item.format === 'carousel' ? 'carousel' : 'post'),
        freeText: copy.body || copy.headline || '',
        templateId: item.templateId || null,
        scriptCards: copy.slides ? copy.slides.map((s: any, i: number) => ({ id: `slide-${i}`, role: i === 0 ? 'cover' : 'slide', title: '', body: typeof s === 'string' ? s : JSON.stringify(s), fields: {} })) : []
      }
      await db.insert(creativeProjects).values({ userId, title: title.substring(0, 490), status: 'em_andamento', format: item.format, templateId: item.templateId, wizardStep: 4, wizardData, metadata: { contentItemId: item.id, planItemId: item.planItemId, scheduledDate: item.scheduledDate } })
      inserted++
    } else {
      await db.update(creativeProjects).set({ status: 'em_andamento' }).where(eq(creativeProjects.id, existing[0].id))
    }
  }
  console.log(`Concluído! ${updated} revertidos, ${inserted} projetos criados.`)
  process.exit(0)
}
fix().catch(e => { console.error(e); process.exit(1) })

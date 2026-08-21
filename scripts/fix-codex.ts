import { db } from '../apps/design-system/src/server/api/db'
import { contentItems, editorialPlanItems } from '../apps/design-system/src/db/editorial-schema'
import { creativeProjects, users } from '../apps/design-system/src/db/schema'
import { eq, and, or, sql } from 'drizzle-orm'

async function fix() {
  console.log("Iniciando correção dos posts aprovados pelo Codex...")
  
  // Buscar o usuário principal (como o Codex pode não ter um usuário setado facilmente, pegamos o primeiro user admin ou o dono)
  const allUsers = await db.select().from(users).limit(1)
  if (allUsers.length === 0) {
    console.error("Nenhum usuário encontrado.")
    return
  }
  const userId = allUsers[0].id

  // Encontrar os contentItems que estão "approved"
  const items = await db.select({
    id: contentItems.id,
    format: contentItems.format,
    status: contentItems.status,
    copyData: contentItems.copyData,
    planItemId: contentItems.planItemId,
    templateId: contentItems.templateId,
    scheduledDate: editorialPlanItems.scheduledDate,
  })
  .from(contentItems)
  .leftJoin(editorialPlanItems, eq(contentItems.planItemId, editorialPlanItems.id))
  .where(or(eq(contentItems.status, 'approved'), eq(contentItems.status, 'ready_for_approval')))

  console.log(`Encontrados ${items.length} itens gerados/aprovados...`)

  let updated = 0
  let inserted = 0

  for (const item of items) {
    // 1. Reverter o status para ready_for_approval se estiver approved
    if (item.status === 'approved') {
      await db.update(contentItems)
        .set({ status: 'ready_for_approval' })
        .where(eq(contentItems.id, item.id))
      updated++
    }

    // 2. Verificar se já existe em creativeProjects
    const existing = await db.select().from(creativeProjects)
      .where(sql`${creativeProjects.metadata}->>'contentItemId' = ${item.id}`)
    
    if (existing.length === 0) {
      // Criar o projeto
      const copy = item.copyData as any || {}
      const title = copy.headline || `Criativo ${item.format} - ${item.scheduledDate || 'Sem data'}`
      
      const wizardData = {
        step: 4,
        creativeType: item.format === 'story' ? 'story' : (item.format === 'carousel' ? 'carousel' : 'post'),
        freeText: copy.body || copy.headline || '',
        templateId: item.templateId || null,
        scriptCards: copy.slides ? copy.slides.map((s: any, i: number) => ({
          id: `slide-${i}`,
          role: i === 0 ? 'cover' : 'slide',
          title: '',
          body: typeof s === 'string' ? s : JSON.stringify(s),
          fields: {}
        })) : []
      }

      await db.insert(creativeProjects).values({
        userId,
        title: title.substring(0, 490),
        status: 'em_andamento', // Como o usuário pediu
        format: item.format,
        templateId: item.templateId,
        wizardStep: 4,
        wizardData,
        metadata: {
          contentItemId: item.id,
          planItemId: item.planItemId,
          scheduledDate: item.scheduledDate
        }
      })
      inserted++
    } else {
      // Garantir que esteja em_andamento
      await db.update(creativeProjects)
        .set({ status: 'em_andamento' })
        .where(eq(creativeProjects.id, existing[0].id))
    }
  }

  console.log(`Concluído! ${updated} itens revertidos para revisão humana. ${inserted} projetos criados.`)
  process.exit(0)
}

fix().catch(e => {
  console.error(e)
  process.exit(1)
})

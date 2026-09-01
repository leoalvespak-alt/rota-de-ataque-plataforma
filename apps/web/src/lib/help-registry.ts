import { z } from 'zod'
import { NAVIGATION, navigationHref } from './navigation'

export const HelpContentSchema = z.object({
  title: z.string(),
  what: z.string(),
  whenToUse: z.string(),
  metrics: z.array(z.object({ name: z.string(), explanation: z.string() })).optional(),
  steps: z.array(z.object({ title: z.string(), description: z.string() })),
  dataSources: z.array(z.object({ name: z.string(), frequency: z.string() })),
  integrations: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
  shortcuts: z.array(z.object({ key: z.string(), action: z.string() })).optional(),
  relatedLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
})

export type HelpContent = z.infer<typeof HelpContentSchema>

export const helpRegistry: Record<string, HelpContent> = {
  '/': {
    title: 'Pulso editorial',
    what: 'Resumo da operação editorial da campanha atual.',
    whenToUse: 'Use para acompanhar decisões pendentes e publicações próximas.',
    steps: [{ title: 'Ver prioridades', description: 'Revise as decisões e oportunidades abertas.' }, { title: 'Acompanhar calendário', description: 'Confira as publicações previstas.' }],
    dataSources: [{ name: 'Banco editorial', frequency: 'Tempo real' }],
  },
}

for (const destination of NAVIGATION) {
  for (const tab of destination.tabs) {
    const key = navigationHref(destination, tab)
    helpRegistry[key] ??= {
      title: destination.title + ' · ' + tab.label_pt,
      what: 'Área editorial de ' + tab.label_pt.toLowerCase() + '.',
      whenToUse: 'Use esta tela para executar e acompanhar o fluxo editorial.',
      steps: [{ title: 'Consultar estado', description: 'Revise os indicadores e itens exibidos.' }, { title: 'Executar ação', description: 'Use apenas as ações disponíveis para o seu papel.' }, { title: 'Confirmar resultado', description: 'Verifique o retorno visual e a trilha operacional.' }],
      dataSources: [{ name: 'Banco editorial', frequency: 'Tempo real' }],
    }
  }
}

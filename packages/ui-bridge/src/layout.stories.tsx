/**
 * Layout component stories (PageHeader, KpiCard, ThreePaneLayout, etc.)
 */
import type { Meta, StoryObj } from '@storybook/react'
import { PageHeader, KpiRow, ThreePaneLayout } from './layout'
import { KpiCard } from './data'

// --- PageHeader ---
const pageHeaderMeta: Meta<typeof PageHeader> = {
  title: 'ui-bridge/PageHeader',
  component: PageHeader,
}
export default pageHeaderMeta

type PageHeaderStory = StoryObj<typeof PageHeader>

export const Default: PageHeaderStory = {
  args: {
    title: 'Página de Exemplo',
    subtitle: 'Uma descrição concisa da finalidade desta tela.',
  },
}

export const WithActions: PageHeaderStory = {
  args: {
    title: 'Painel de Leads',
    subtitle: 'Prospecção ativa com score e prioridade.',
    actions: <button>Exportar CSV</button>,
  },
}

export const WithHelpContent: PageHeaderStory = {
  args: {
    title: 'Radar de Mercado',
    subtitle: 'Sinais de oportunidade em tempo real.',
    helpContent: {
      title: 'O que é o Radar de Mercado?',
      what: 'Detecta oportunidades de conteúdo e prospecção.',
      whenToUse: 'Use para encontrar pautas quentes.',
      steps: [
        {
          title: 'Sobre',
          description: 'O Radar detecta oportunidades de conteúdo.',
        }
      ],
      dataSources: [
        { name: 'Web', frequency: 'Real-time' }
      ]
    },
  },
}

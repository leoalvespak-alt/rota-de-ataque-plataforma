import type { Meta, StoryObj } from '@storybook/react-vite'
import { TodayClient } from './TodayClient'

const meta = { title: 'Pages/Hoje', component: TodayClient, args: { initialData: {
  generatedAt: '2026-08-22T12:00:00.000Z', campaign: { id: 'campaign', name: 'Rota de Ataque' },
  decisions: { review: 3, radar: 2, insights: 1, suggestions: 4, engagement: 2 },
  slots: [{ id: 'slot', title: 'Post editorial', channel: 'instagram', scheduled_for: '2026-08-22T18:00:00.000Z' }],
  engines: [{ key: 'M2', name: 'Inteligência', state: 'attention', errors: 0, divergent: 1 }],
  failedQueues: [], expiringTokens: [], actions: [{ label: 'Revisar decisões pendentes', href: '/decisoes?aba=revisao' }],
} } } satisfies Meta<typeof TodayClient>
export default meta
export const Default: StoryObj<typeof meta> = {}

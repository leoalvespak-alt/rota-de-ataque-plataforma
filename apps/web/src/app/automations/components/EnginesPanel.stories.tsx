import type { Meta, StoryObj } from '@storybook/react-vite'
import { MotoresTab, type EngineState } from './MotoresTab'

const engine: EngineState = {
  key: 'M2', slug: 'inteligencia', name_pt: 'Inteligência', description_pt: 'Transforma sinais em decisões acionáveis.',
  alwaysOn: false, dependsOn: ['M0', 'M1'], enableCascade: ['M0', 'M1', 'M2'], disableCascade: ['M2'], state: 'attention',
  enabledWorkers: 1, totalWorkers: 2, cadence: 'A cada 15 minutos', queue: { waiting: 3, active: 1, failed: 0 }, queueAvailable: true,
  divergences: [{ worker: 'competitive-intel', label: 'Inteligência competitiva', kind: 'configured_but_not_running' }],
  prerequisites: [{ key: 'ai_provider_configured', satisfied: true, label_pt: 'Provedor de IA configurado', href: '/automacoes?aba=ia' }],
  workers: [{ worker_name: 'competitive-intel', label_pt: 'Inteligência competitiva', enabled: true, schedulable: true, heartbeat_state: 'stopped' }, { worker_name: 'content-opportunity', label_pt: 'Oportunidades', enabled: false, schedulable: false, heartbeat_state: null }],
}

const meta = { title: 'Pages/Automacoes/EnginesPanel', component: MotoresTab, args: { initialEngines: [engine] } } satisfies Meta<typeof MotoresTab>
export default meta
export const Attention: StoryObj<typeof meta> = {}

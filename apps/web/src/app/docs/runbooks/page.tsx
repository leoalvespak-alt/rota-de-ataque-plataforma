import { RunbooksClient } from './RunbooksClient'

export default async function RunbooksIndexPage() {
  const runbooks = [
    { slug: 'system-health', title: 'Recuperação de Saúde do Sistema', tags: ['P0', 'Infra'], status: 'active' },
    { slug: 'accounts', title: 'Recuperação de Contas Meta Suspensas', tags: ['P1', 'Meta'], status: 'active' },
    { slug: 'rate-limits', title: 'Mitigação de Rate Limits Meta', tags: ['P1', 'API'], status: 'active' },
  ]
  return <RunbooksClient runbooks={runbooks} />
}

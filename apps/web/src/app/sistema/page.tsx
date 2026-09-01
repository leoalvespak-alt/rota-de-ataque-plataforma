import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { ModulePage } from '@/components/ModulePage'
import { getIntegrationCapabilities } from '@/lib/integration-capabilities'
import SystemHealthView from './saude/page'

const CORE_WORKERS = ['news-radar', 'content-opportunity', 'content-item-orchestrator'] as const

export default async function SystemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  if (params.aba === 'saude') return <SystemHealthView />
  if (params.aba === 'ia') return <Link href="/ai-settings">Abrir configurações de IA</Link>

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  try {
    const workers = (await pool.query<{ worker_name: string; enabled: boolean; heartbeat_state: string | null; incident_id: string | null }>(
      'SELECT ws.worker_name,ws.enabled,heartbeat.state heartbeat_state,incident.id incident_id FROM worker_settings ws LEFT JOIN LATERAL (SELECT state FROM worker_heartbeats WHERE worker=ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true LEFT JOIN LATERAL (SELECT id FROM automation_incidents WHERE worker_name=ws.worker_name AND resolved_at IS NULL ORDER BY occurred_at DESC LIMIT 1) incident ON true WHERE ws.worker_name = ANY($1::text[]) ORDER BY ws.worker_name',
      [CORE_WORKERS],
    )).rows
    const capabilities = await getIntegrationCapabilities(pool)
    const healthyWorkers = workers.filter((worker) => worker.enabled && worker.heartbeat_state === 'running' && !worker.incident_id).length
    const openIncidents = workers.filter((worker) => worker.incident_id).length
    return <ModulePage eyebrow="Prontidão editorial" title="Sistema" subtitle="Saúde dos três processos editoriais e das integrações necessárias." metrics={[{ label: 'Workers editoriais saudáveis', value: healthyWorkers, unit: '/ ' + CORE_WORKERS.length, period: 'estado atual', sourceStatus: 'ready', href: '/sistema/saude' }, { label: 'Workers habilitados', value: workers.filter((worker) => worker.enabled).length, unit: '/ ' + CORE_WORKERS.length, period: 'estado desejado', sourceStatus: 'ready', href: '/sistema/saude' }, { label: 'Incidentes abertos', value: openIncidents, period: 'não resolvidos', sourceStatus: openIncidents ? 'degraded' : 'ready', href: '/sistema/saude' }, { label: 'Integrações prontas', value: capabilities.filter((capability) => capability.status === 'ready').length, period: 'checklist atual', sourceStatus: 'ready', href: '/sistema/integracoes' }]} navigation={[{ label: 'Visão geral', href: '/sistema' }, { label: 'Saúde', href: '/sistema/saude' }, { label: 'Integrações', href: '/sistema/integracoes' }]} main={<><header className="module-panel-header"><div><p className="module-eyebrow">Checklist editorial</p><h2>O que está pronto para operar</h2></div><Link href="/sistema/integracoes">Ver integrações →</Link></header><div className="module-list">{capabilities.map((capability) => <article key={capability.id}><span className={capability.status === 'ready' ? 'source-status ready' : 'source-status degraded'}>{capability.status}</span><strong>{capability.name}</strong><span>{capability.detail}</span>{capability.missing.length > 0 && <small aria-label="Pré-requisitos ausentes">Pré-requisitos ausentes: {capability.missing.join(', ')}</small>}</article>)}</div></>} rail={<><section><p className="module-eyebrow">Núcleo</p><h2>Radar → oportunidade → conteúdo</h2><p>As três lógicas preservadas para o editorial. Agendamentos externos ficam para fases posteriores.</p><Link href="/sistema/saude">Ver saúde →</Link></section><section><p className="module-eyebrow">Configuração</p><h2>Modelo editorial</h2><p><Link href="/ai-settings">IA</Link> · <Link href="/sistema/integracoes">Integrações</Link></p></section></>} />
  } finally {
    await pool.end()
  }
}

import Link from 'next/link'
import { createDatabase } from '@plataforma/db'
import { AUTOMATION_ENGINES } from '@plataforma/shared'
import { ModulePage } from '@/components/ModulePage'
import { getIntegrationCapabilities } from '@/lib/integration-capabilities'
import AutomationsView from '../automations/view'
import SettingsPage from '../configuracoes/page'
import NotificationsView from '../notifications/view'
import SystemHealthView from '../system-health/view'

export default async function SystemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const legacyTab = typeof params.aba === 'string' ? params.aba : null
  if (legacyTab === 'motores') return <AutomationsView searchParams={Promise.resolve(params)} />
  if (legacyTab === 'notificacoes') return <NotificationsView />
  if (legacyTab === 'saude') return <SystemHealthView />
  if (legacyTab === 'contas' || legacyTab === 'ia' || legacyTab === 'scoring') return <SettingsPage searchParams={Promise.resolve(params)} />

  const { pool } = createDatabase(process.env.DATABASE_URL!)
  const workers = (await pool.query<{ worker_name: string; engine_key: string; enabled: boolean; heartbeat_state: string | null; incident_id: string | null }>(`SELECT ws.worker_name,ws.engine_key,ws.enabled,heartbeat.state heartbeat_state,incident.id incident_id FROM worker_settings ws LEFT JOIN LATERAL (SELECT state FROM worker_heartbeats WHERE worker=ws.worker_name ORDER BY last_beat_at DESC LIMIT 1) heartbeat ON true LEFT JOIN LATERAL (SELECT id FROM automation_incidents WHERE worker_name=ws.worker_name AND resolved_at IS NULL ORDER BY occurred_at DESC LIMIT 1) incident ON true ORDER BY ws.engine_key,ws.worker_name`)).rows
  const capabilities = await getIntegrationCapabilities(pool)
  const openIncidents = workers.filter((worker) => worker.incident_id).length
  const healthyEngines = AUTOMATION_ENGINES.filter((engine) => workers.filter((worker) => worker.engine_key === engine.key).every((worker) => !worker.enabled || (worker.heartbeat_state === 'running' && !worker.incident_id))).length
  const externalReddit = capabilities.find((capability) => capability.id === 'reddit-external')
  return <ModulePage eyebrow="Prontidão e administração" title="Sistema" subtitle="Estado desejado, runtime, prontidão, incidentes e integrações sem poluir o caminho operacional." metrics={[{ label: 'Motores saudáveis', value: healthyEngines, unit: `/ ${AUTOMATION_ENGINES.length}`, period: 'estado atual', sourceStatus: 'ready', href: '/sistema/motores' }, { label: 'Bloqueios de ativação', value: workers.filter((worker) => !worker.enabled && worker.heartbeat_state !== 'running').length, period: 'requisitos pendentes', sourceStatus: 'ready', href: '/sistema/motores' }, { label: 'Incidentes abertos', value: openIncidents, period: 'não resolvidos', sourceStatus: openIncidents ? 'degraded' : 'ready', href: '/sistema/incidentes' }, { label: 'Integrações prontas', value: capabilities.filter((capability) => capability.status === 'ready').length, period: 'checklist atual', sourceStatus: 'ready', href: '/sistema/integracoes' }]} navigation={[{ label: 'Visão geral', href: '/sistema' }, { label: 'Motores', href: '/sistema/motores' }, { label: 'Integrações', href: '/sistema/integracoes' }, { label: 'Incidentes', href: '/sistema/incidentes' }, { label: 'Avançado', href: '/sistema/avancado/workers' }]} main={<><header className="module-panel-header"><div><p className="module-eyebrow">Checklist de prontidão</p><h2>O que está pronto para operar</h2></div><Link href="/sistema/integracoes">Configurar integração →</Link></header><div className="module-list">{capabilities.map((capability) => <article key={capability.id}><span className={`source-status ${capability.status === 'ready' ? 'ready' : capability.status === 'degraded' || capability.status === 'partial' ? 'degraded' : capability.status === 'disabled' ? '' : 'blocked'}`}>{capability.status}</span><strong>{capability.name}</strong><span>{capability.detail}</span>{capability.missing.length > 0 && <small>Falta: {capability.missing.join(', ')}</small>}</article>)}</div></>} rail={<><section><p className="module-eyebrow">Reddit</p><h2>{externalReddit?.status === 'ready' ? 'Via provedores externos' : 'Canário pendente'}</h2><p>{externalReddit?.detail ?? 'Configure Apify ou Bright Data para habilitar a coleta.'}</p><Link href="/sistema/integracoes">Ver prontidão →</Link></section><section><p className="module-eyebrow">Avançado</p><h2>Divulgação progressiva</h2><p><Link href="/sistema/avancado/workers">Workers</Link> · <Link href="/sistema/avancado/filas">Filas</Link> · <Link href="/sistema/avancado/agendamentos">Agendamentos</Link></p><p><Link href="/sistema/avancado/runbooks">Runbooks</Link> · <Link href="/sistema/avancado/ia">IA</Link> · <Link href="/sistema/avancado/scoring">Scoring</Link></p></section></>} />
}


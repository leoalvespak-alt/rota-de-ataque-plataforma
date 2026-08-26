'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Dialog, EmptyState, ErrorState, IntegrationState, KpiCard, KpiRow, StatusBadge } from '@plataforma/ui-bridge'
import { Play, Power } from 'lucide-react'
import { appPath } from '@/lib/base-path'
import { resolvePageState } from '@/lib/page-state'

interface PrerequisiteState {
  key: string
  satisfied: boolean
  label_pt: string
  href: string
}

interface EngineWorker {
  worker_name: string
  label_pt: string
  enabled: boolean
  schedulable: boolean
  heartbeat_state: string | null
}

export interface EngineState {
  key: string
  slug: string
  name_pt: string
  description_pt: string
  alwaysOn: boolean
  dependsOn: string[]
  enableCascade: string[]
  disableCascade: string[]
  state: 'off' | 'starting' | 'on' | 'attention' | 'error'
  desiredState?: 'off' | 'on' | 'on_partial'
  runtimeState?: 'absent' | 'starting' | 'running' | 'paused'
  lastRunState?: 'never' | 'succeeded' | 'skipped' | 'blocked' | 'failed'
  lastRunReasonCode?: string | null
  lastSuccessAt?: string | null
  enabledWorkers: number
  totalWorkers: number
  cadence: string | null
  queue: { waiting: number; active: number; failed: number }
  queueAvailable: boolean
  divergences: Array<{ worker: string; label: string; kind: string }>
  prerequisites: PrerequisiteState[]
  workers: EngineWorker[]
}

interface PendingAction {
  engine: EngineState
  action: 'enable' | 'disable'
  engineKeys: string[]
  workers: EngineWorker[]
}

export function MotoresTab({ initialEngines }: { initialEngines?: EngineState[] } = {}) {
  const [engines, setEngines] = useState<EngineState[]>(initialEngines ?? [])
  const [loading, setLoading] = useState(!initialEngines)
  const [forbidden, setForbidden] = useState(false)
  const [providerAvailable, setProviderAvailable] = useState(true)
  const [error, setError] = useState<{ message: string; traceId: string } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const fetchEngines = useCallback(async () => {
    try {
      const response = await fetch(appPath('/api/admin/automations/engines'), { cache: 'no-store' })
      const body = await response.json().catch(() => ({})) as {
        engines?: EngineState[]
        providerAvailable?: boolean
        error?: string
        traceId?: string
      }
      if (response.status === 401 || response.status === 403) {
        setForbidden(true)
        return
      }
      if (!response.ok) throw Object.assign(new Error(body.error ?? 'Falha ao carregar motores'), { traceId: body.traceId })
      setEngines(body.engines ?? [])
      setProviderAvailable(body.providerAvailable !== false)
      setForbidden(false)
      setError(null)
    } catch (caught) {
      setError({
        message: caught instanceof Error ? caught.message : 'Falha ao carregar motores',
        traceId: (caught as { traceId?: string }).traceId ?? 'trace_indisponivel',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialEngines) return
    void fetchEngines()
    const interval = setInterval(fetchEngines, 15_000)
    return () => clearInterval(interval)
  }, [fetchEngines, initialEngines])

  function prepareToggle(engine: EngineState) {
    const action = engine.desiredState === 'off' || (engine.desiredState === undefined && engine.enabledWorkers === 0) ? 'enable' : 'disable'
    const cascadeKeys = action === 'enable' ? engine.enableCascade : engine.disableCascade
    const engineKeys = [...cascadeKeys, engine.key]
    const workers = engines
      .filter((item) => engineKeys.includes(item.key))
      .flatMap((item) => item.workers)
      .filter((worker, index, rows) => rows.findIndex((item) => item.worker_name === worker.worker_name) === index)
    setPending({ engine, action, engineKeys, workers })
  }

  async function confirmToggle() {
    if (!pending) return
    setBusy(`${pending.engine.key}:${pending.action}`)
    setMessage('')
    try {
      const response = await fetch(appPath('/api/admin/automations/engines'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          engineKey: pending.engine.key,
          action: pending.action,
          cascade: pending.engineKeys.length > 1,
        }),
      })
      const body = await response.json().catch(() => ({})) as { error?: string; changed?: string[] }
      if (!response.ok) throw new Error(body.error ?? 'Falha ao alterar o motor')
      setMessage(body.changed?.length
        ? `${body.changed.length} automações foram atualizadas.`
        : 'O motor já estava no estado solicitado.')
      setPending(null)
      await fetchEngines()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Falha inesperada.')
    } finally {
      setBusy(null)
    }
  }

  async function runNow(engineKey: string) {
    setBusy(`${engineKey}:run_now`)
    setMessage('')
    try {
      const response = await fetch(appPath(`/api/admin/automations/engines/${engineKey}/run-now`), { method: 'POST' })
      const body = await response.json().catch(() => ({})) as { error?: string; enqueued?: string[]; failed?: string[] }
      if (!response.ok) throw new Error(body.error ?? 'Falha ao enfileirar execução')
      setMessage(`${body.enqueued?.length ?? 0} automações enfileiradas${body.failed?.length ? `; ${body.failed.length} falharam` : ''}.`)
      await fetchEngines()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Falha inesperada.')
    } finally {
      setBusy(null)
    }
  }

  const pageState = resolvePageState({
    loading,
    hasCampaign: true,
    itemCount: engines.length,
    permitted: !forbidden,
    providerAvailable,
    failed: Boolean(error),
  })
  if (pageState === 'loading') return <section aria-busy="true" style={{ padding: 40 }}>Carregando motores…</section>
  if (pageState === 'forbidden') return <EmptyState message="Seu papel não permite visualizar as automações." />
  if (pageState === 'error') return <ErrorState traceId={error?.traceId ?? 'trace_indisponivel'} runbook="/docs/runbooks/automations" onRetry={() => void fetchEngines()} />
  if (pageState === 'empty') return <EmptyState message="Nenhum motor de automação foi encontrado." />

  return <div style={{ display: 'grid', gap: 24, paddingTop: 16 }}>
    {pageState === 'provider_error' && <IntegrationState name="BullMQ / Redis" status="degraded" detail="As filas estão indisponíveis. Os estados persistidos continuam visíveis, mas ações devem aguardar a recuperação do provider." />}
    {message && <p role="status" className="bridge-inline-notice">{message}</p>}
    <KpiRow>
      <KpiCard label="Motores" value={engines.length} />
      <KpiCard label="Ativos" value={engines.filter((engine) => engine.state === 'on').length} />
      <KpiCard label="Em atenção" value={engines.filter((engine) => engine.state === 'attention' || engine.state === 'starting').length} />
      <KpiCard label="Com falhas" value={engines.filter((engine) => engine.state === 'error').length} trend="down" />
    </KpiRow>
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
      {engines.map((engine) => {
        const turningOn = engine.desiredState === 'off' || (engine.desiredState === undefined && engine.enabledWorkers === 0)
        const missingPrerequisites = engine.prerequisites.filter((item) => !item.satisfied)
        const blocked = turningOn && missingPrerequisites.length > 0
        return <article key={engine.key} className="card" style={{ padding: 20, display: 'grid', gap: 16 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div><small>{engine.key}</small><h2 style={{ margin: '2px 0 4px' }}>{engine.name_pt}</h2><p style={{ margin: 0 }}>{engine.description_pt}</p></div>
            <StatusBadge status={engine.state === 'on' ? 'Rodando' : engine.state === 'error' ? 'Erro' : engine.state === 'attention' ? 'Atenção' : engine.state === 'starting' ? 'Iniciando' : 'Desligado'} />
          </header>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span>{engine.enabledWorkers} de {engine.totalWorkers} automações ligadas</span>
            <span>Runtime: {engine.runtimeState === 'running' ? 'rodando' : engine.runtimeState === 'paused' ? 'pausado' : engine.runtimeState === 'starting' ? 'iniciando' : 'ausente'}</span>
            <span>Última execução: {engine.lastRunState ?? 'nunca'}{engine.lastRunReasonCode ? ` · ${engine.lastRunReasonCode}` : ''}</span>
            <span>Fila: {engine.queue.waiting} aguardando · {engine.queue.active} ativas · {engine.queue.failed} falhas</span>
            <span>Cadência: {engine.cadence ?? 'sem cadência própria'}</span>
          </div>
          {engine.lastRunState === 'failed' && <p className="bridge-inline-notice" role="alert">A última execução falhou{engine.lastSuccessAt ? `; último sucesso em ${new Date(engine.lastSuccessAt).toLocaleString('pt-BR')}` : ''}. O runtime atual não é derivado desse erro histórico.</p>}
          {engine.divergences.length > 0 && <p className="bridge-inline-notice" role="status">{engine.divergences.length} divergência(s) operacional(is).</p>}
          {blocked && <section className="bridge-inline-notice">
            <strong>Pré-requisitos pendentes</strong>
            <ul>{missingPrerequisites.map((item) => <li key={item.key}><a href={appPath(item.href)}>{item.label_pt}</a></li>)}</ul>
          </section>}
          <details>
            <summary>Ver automações</summary>
            <ul>{engine.workers.map((worker) => <li key={worker.worker_name}>
              <strong>{worker.label_pt}</strong> · <code>{worker.worker_name}</code> · {worker.enabled ? 'ligada' : 'desligada'} · {worker.heartbeat_state ?? 'sem heartbeat'}
            </li>)}</ul>
          </details>
          <footer className="bridge-action-group">
            {(!engine.alwaysOn || turningOn) && <Button variant={turningOn ? 'primary' : 'danger'} disabled={busy !== null || blocked} onClick={() => prepareToggle(engine)}>
              <Power size={14} aria-hidden /> {turningOn ? 'Ligar' : 'Desligar'}
            </Button>}
            {engine.workers.some((worker) => worker.schedulable) && <Button variant="secondary" disabled={busy !== null || !engine.queueAvailable} onClick={() => void runNow(engine.key)}>
              <Play size={14} aria-hidden /> Executar agora
            </Button>}
          </footer>
        </article>
      })}
    </div>
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !busy) setPending(null) }} title={pending?.action === 'enable' ? 'Confirmar ativação' : 'Confirmar desativação'} busy={busy !== null}>
      {pending && <div style={{ display: 'grid', gap: 12 }}>
        <p>A ação afetará nominalmente estas {pending.workers.length} automações:</p>
        <ul style={{ maxHeight: 320, overflowY: 'auto' }}>{pending.workers.map((worker) => <li key={worker.worker_name}><strong>{worker.label_pt}</strong> · <code>{worker.worker_name}</code></li>)}</ul>
        <div className="bridge-action-group">
          <Button variant="quiet" disabled={busy !== null} onClick={() => setPending(null)}>Cancelar</Button>
          <Button variant={pending.action === 'enable' ? 'primary' : 'danger'} disabled={busy !== null} onClick={() => void confirmToggle()}>Confirmar</Button>
        </div>
      </div>}
    </Dialog>
  </div>
}

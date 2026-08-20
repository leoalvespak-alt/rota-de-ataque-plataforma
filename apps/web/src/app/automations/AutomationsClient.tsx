'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, DataGrid, KpiCard, KpiRow, PageHeader, StatusBadge, createColumnHelper, gridFeatures } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

interface WorkerInfo {
  worker_name: string; enabled: boolean; domain: string; cadence: string | null
  last_execution_at: string | null; items_processed: number; last_error: string | null
  heartbeat_state: string | null; last_beat_at: string | null; jobs_done_window: number | null
  bullmq: { waiting: number; delayed: number; active: number; completed: number; failed: number } | null
  divergence: string | null
}

const labels: Record<string, string> = { radar: 'Radar', intelligence: 'Inteligência', publishing: 'Publicação', messaging: 'Mensageria', maintenance: 'Manutenção', general: 'Geral' }
const order = ['radar', 'intelligence', 'publishing', 'messaging', 'maintenance', 'general']
const column = createColumnHelper<typeof gridFeatures, WorkerInfo>()

function formatTime(value: string | null) {
  if (!value) return '—'
  const elapsed = Date.now() - new Date(value).getTime()
  if (elapsed < 60_000) return 'agora'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min atrás`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} h atrás`
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AutomationsClient({ workers: initialWorkers }: { workers: WorkerInfo[] }) {
  const [workers, setWorkers] = useState(initialWorkers)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<{ workerName: string; cadence: string } | null>(null)
  const [killSwitch, setKillSwitch] = useState<{ active: boolean; origin: string } | null>(null)
  useEffect(() => { void fetch(appPath('/api/admin/publishing/kill-switch')).then(async response => response.ok ? response.json() as Promise<{ active: boolean; origin?: string }> : null).then(body => setKillSwitch(body ? { active: body.active, origin: body.origin ?? 'worker_settings' } : null)).catch(() => setKillSwitch(null)) }, [])
  const action = useCallback(async (workerName: string, actionName: string) => {
    setLoading(`${workerName}:${actionName}`); setMessage(null)
    try {
      const response = await fetch(appPath('/api/admin/automations'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerName, action: actionName }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Falha ao executar ação')
      setWorkers((current) => current.map((worker) => worker.worker_name === workerName ? { ...worker, enabled: ['enable', 'resume'].includes(actionName) ? true : ['disable', 'pause'].includes(actionName) ? false : worker.enabled } : worker))
      setMessage(`Ação concluída: ${workerName}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha inesperada.') } finally { setLoading(null) }
  }, [])

  const saveSchedule = useCallback(async () => {
    if (!editingSchedule) return
    setLoading(`${editingSchedule.workerName}:set_schedule`); setMessage(null)
    try {
      const response = await fetch(appPath('/api/admin/automations'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerName: editingSchedule.workerName, action: 'set_schedule', cadence: editingSchedule.cadence }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Falha ao salvar agendamento')
      setWorkers((current) => current.map((w) => w.worker_name === editingSchedule.workerName ? { ...w, cadence: editingSchedule.cadence } : w))
      setMessage(`Agendamento salvo: ${editingSchedule.workerName}.`)
      setEditingSchedule(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha inesperada.') } finally { setLoading(null) }
  }, [editingSchedule])

  const columns = useMemo(() => [
    column.accessor('worker_name', { header: 'Worker', cell: (info) => <><code>{info.getValue()}</code>{info.row.original.divergence && <small> · configuração divergente</small>}</> }),
    column.accessor('enabled', { header: 'Configuração', cell: (info) => <StatusBadge status={info.getValue() ? 'Ativo' : 'Inativo'} /> }),
    column.display({ id: 'health', header: 'Saúde', cell: (info) => <StatusBadge status={info.row.original.last_error ? 'Erro' : info.row.original.heartbeat_state === 'running' ? 'Rodando' : 'Sem heartbeat'} /> }),
    column.display({ id: 'lastRun', header: 'Última execução', cell: (info) => formatTime(info.row.original.last_execution_at ?? info.row.original.last_beat_at) }),
    column.display({ id: 'processed', header: 'Processados', cell: (info) => info.row.original.items_processed || info.row.original.jobs_done_window || 0 }),
    column.display({ id: 'queue', header: 'Fila', cell: (info) => { const queue = info.row.original.bullmq; return queue ? `${queue.waiting} aguardando · ${queue.active} ativos · ${queue.failed} falhos` : 'Indisponível' } }),
    column.display({ id: 'cadence', header: 'Agendamento', cell: (info) => {
      const worker = info.row.original
      if (editingSchedule?.workerName === worker.worker_name) {
        return <div style={{ display: 'flex', gap: '4px' }}>
          <input value={editingSchedule.cadence} onChange={(e) => setEditingSchedule({ workerName: worker.worker_name, cadence: e.target.value })} placeholder="ex: every:900000 ou 0 */4 * * *" style={{ fontSize: '12px', padding: '2px 6px', width: '200px' }} />
          <Button size="sm" variant="primary" disabled={loading === `${worker.worker_name}:set_schedule`} onClick={saveSchedule}>Salvar</Button>
          <Button size="sm" variant="quiet" onClick={() => setEditingSchedule(null)}>Cancelar</Button>
        </div>
      }
      return <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <code style={{ fontSize: '11px' }}>{worker.cadence ?? '—'}</code>
        <Button size="sm" variant="quiet" onClick={() => setEditingSchedule({ workerName: worker.worker_name, cadence: worker.cadence ?? '' })}>Editar</Button>
      </div>
    } }),
    column.display({ id: 'actions', header: 'Ações', cell: (info) => { const worker = info.row.original; const toggle = worker.enabled ? 'disable' : 'enable'; return <div className="bridge-action-group"><Button size="sm" variant={worker.enabled ? 'danger' : 'primary'} disabled={loading === `${worker.worker_name}:${toggle}`} onClick={() => action(worker.worker_name, toggle)}>{worker.enabled ? 'Desligar' : 'Ligar'}</Button><Button size="sm" variant="secondary" disabled={loading === `${worker.worker_name}:run_now`} onClick={() => action(worker.worker_name, 'run_now')}>Executar</Button>{worker.bullmq && worker.bullmq.failed > 0 && <Button size="sm" variant="quiet" disabled={loading === `${worker.worker_name}:clear_dlq`} onClick={() => action(worker.worker_name, 'clear_dlq')}>Limpar DLQ</Button>}</div> } }),
  ], [action, loading, editingSchedule, saveSchedule])
  const groups = order.map((domain) => ({ domain, workers: workers.filter((worker) => worker.domain === domain) })).filter((group) => group.workers.length)
  const active = workers.filter((worker) => worker.enabled).length

  return <main className="bridge-page-content">
    <PageHeader title="Automações" subtitle="Controle operacional de workers, filas e saúde." />
    {message && <p role="status" className="bridge-inline-notice">{message}</p>}
    <p role="status" className="bridge-inline-notice">{killSwitch === null ? 'Kill-switch indisponível: não foi possível consultar a origem.' : killSwitch.active ? `Publicação habilitada · origem: ${killSwitch.origin}` : `Kill-switch ativo: publicações bloqueadas · origem: ${killSwitch.origin}`}</p>
    <KpiRow><KpiCard label="Total" value={workers.length} /><KpiCard label="Ativos" value={active} /><KpiCard label="Rodando" value={workers.filter((worker) => worker.heartbeat_state === 'running').length} /><KpiCard label="Com erro" value={workers.filter((worker) => worker.last_error).length} trend="down" /></KpiRow>
    {groups.map((group) => <section key={group.domain} className="bridge-section"><h2>{labels[group.domain] ?? group.domain}</h2><DataGrid data={group.workers} columns={columns} enableSorting label={`Workers de ${labels[group.domain] ?? group.domain}`} /></section>)}
  </main>
}

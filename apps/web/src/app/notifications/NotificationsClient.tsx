'use client'

import { DataGrid, EmptyState, IntegrationState, KpiCard, KpiRow, PageHeader, PriorityChip, StatusBadge, TabArrowButtons } from '@plataforma/ui-bridge'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { appPath } from '@/lib/base-path'
import type { IntegrationCapability } from '@/lib/integration-capabilities'

interface Trigger { id: string; name: string; match_expr: string; severity: string; channels: string[]; active: boolean; hit_count: number; throttle_seconds: number; last_hit_at: string | null }
interface Alert { id: string; kind: string; severity: 'info' | 'warn' | 'error' | 'critical'; payload: Record<string, unknown>; created_at: string; resolved_at: string | null }
interface Delivery { id: string; channel: string; status: string; attempts: number; sent_at: string | null; last_error: string | null }

const TABS = ['Triggers', 'Canais', 'Incidentes', 'Entregas'] as const
type NotificationTab = typeof TABS[number]
const deliveryColumns = [{ accessorKey: 'channel', header: 'Canal' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'attempts', header: 'Tentativas' }, { accessorKey: 'sent_at', header: 'Data do envio' }, { accessorKey: 'last_error', header: 'Erro' }]

function priority(severity: string) { return severity === 'critical' ? 'P0' : severity === 'error' ? 'P1' : 'P2' }

export function NotificationsClient({ triggers: initialTriggers, alerts, deliveries, capabilities = [] }: { triggers: Trigger[]; alerts: Alert[]; deliveries: Delivery[]; capabilities?: IntegrationCapability[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const rawTab = searchParams.get('tab') as NotificationTab | null
  const tab = rawTab && TABS.includes(rawTab) ? rawTab : 'Triggers'
  const [triggers, setTriggers] = useState(initialTriggers)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const setTab = (next: NotificationTab) => { const params = new URLSearchParams(searchParams.toString()); params.set('tab', next); router.replace(`${pathname}?${params.toString()}`, { scroll: false }) }
  async function toggle(item: Trigger) {
    setBusy(item.id); setMessage('')
    try {
      const response = await fetch(appPath('/api/admin/notifications/triggers'), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...item, active: !item.active }) })
      if (!response.ok) throw new Error('Não foi possível atualizar o trigger')
      setTriggers((items) => items.map((value) => value.id === item.id ? { ...value, active: !value.active } : value)); setMessage('Trigger atualizado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro inesperado') } finally { setBusy('') }
  }
  async function test() {
    setBusy('test'); setMessage('')
    try { const response = await fetch(appPath('/api/admin/notifications/test'), { method: 'POST' }); if (!response.ok) throw new Error('Falha no teste'); setMessage('Teste de canais concluído.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro inesperado') } finally { setBusy('') }
  }

  const tabIndex = TABS.indexOf(tab)
  return <main className="page"><PageHeader title="Notificações e erros" subtitle="Detecção, entrega e resposta operacional" /><KpiRow><KpiCard label="Triggers ativos" value={triggers.filter((item) => item.active).length} /><KpiCard label="Incidentes abertos" value={alerts.filter((item) => !item.resolved_at).length} /><KpiCard label="Falhas de entrega" value={deliveries.filter((item) => item.status === 'failed').length} /><KpiCard label="Entregas" value={deliveries.length} /></KpiRow><div className="bridge-tab-navigation"><TabArrowButtons previous={tabIndex > 0 ? { label: TABS[tabIndex - 1]!, onSelect: () => setTab(TABS[tabIndex - 1]!) } : undefined} next={tabIndex < TABS.length - 1 ? { label: TABS[tabIndex + 1]!, onSelect: () => setTab(TABS[tabIndex + 1]!) } : undefined} /><nav role="tablist" aria-label="Seções de notificação" className="tabs">{TABS.map((item, index) => <button key={item} role="tab" aria-selected={tab === item} aria-controls={`notification-panel-${index}`} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={(event) => { if (event.key === 'ArrowRight') setTab(TABS[(index + 1) % TABS.length] ?? 'Triggers'); if (event.key === 'ArrowLeft') setTab(TABS[(index - 1 + TABS.length) % TABS.length] ?? 'Triggers') }}>{item}</button>)}</nav></div><p role="status" aria-live="polite">{message}</p>
    {tab === 'Triggers' && <section id="notification-panel-0" role="tabpanel" aria-label="Triggers"><h2>Triggers ({triggers.length})</h2>{triggers.length ? triggers.map((item) => <article className="trigger-row" key={item.id}><div><strong>{item.name}</strong><code>{item.match_expr}</code><small>{item.hit_count} ocorrências · intervalo {item.throttle_seconds}s</small></div><PriorityChip priority={priority(item.severity) as 'P0' | 'P1' | 'P2' | 'P3'} /><span>{item.channels.join(', ') || 'sem canal'}</span><button disabled={busy === item.id} onClick={() => void toggle(item)}>{item.active ? 'Desativar' : 'Ativar'}</button></article>) : <EmptyState message="Nenhum trigger configurado." />}</section>}
    {tab === 'Canais' && <section id="notification-panel-1" role="tabpanel" aria-label="Canais"><div className="integration-grid">{capabilities.filter((item) => ['resend', 'runtime'].includes(item.id)).map((item) => <IntegrationState key={item.id} name={item.name} status={item.status} detail={item.detail} />)}</div><button disabled={busy === 'test'} onClick={() => void test()}>{busy === 'test' ? 'Enviando…' : 'Enviar teste aos canais configurados'}</button></section>}
    {tab === 'Incidentes' && <section id="notification-panel-2" role="tabpanel" aria-label="Incidentes">{alerts.length ? alerts.map((item) => <article className="card" key={item.id}><header><PriorityChip priority={priority(item.severity) as 'P0' | 'P1' | 'P2' | 'P3'} /><strong>{item.kind}</strong><StatusBadge status={item.resolved_at ? 'Resolvido' : 'Aberto'} /><time>{new Date(item.created_at).toLocaleString('pt-BR')}</time></header><dl>{Object.entries(item.payload).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></article>) : <EmptyState message="Nenhum incidente registrado." />}</section>}
    {tab === 'Entregas' && <section id="notification-panel-3" role="tabpanel" aria-label="Entregas">{deliveries.length ? <DataGrid data={deliveries} columns={deliveryColumns} label="Entregas de notificação" /> : <EmptyState message="Nenhuma entrega registrada." />}</section>}
  </main>
}

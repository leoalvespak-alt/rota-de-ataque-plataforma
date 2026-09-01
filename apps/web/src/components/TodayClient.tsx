'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, FreshnessLabel, KpiSkeleton, ModuleHeader, MetricStrip, SectionHeader, StatusBadge, WorkspaceGrid } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

export type TodayData = {
  generatedAt: string
  campaign: { id: string; name: string } | null
  decisions: { review: number; radar: number; insights: number; suggestions: number; engagement: number }
  slots: Array<{ id: string; title: string; channel: string; scheduled_for: string }>
  engines: Array<{ key: string; name: string; state: 'attention' | 'error'; errors: number; divergent: number; reasonCode?: string | null; title?: string | null; impact?: string | null; nextAction?: string | null; traceId?: string | null }>
  failedQueues: Array<{ name: string; failed: number }>
  expiringTokens: Array<{ id: string; username: string; role: string; expires_at: string }>
  actions: Array<{ label: string; href: string }>
  meta?: { traceId?: string }
}

export function TodayClient({ initialData }: { initialData?: TodayData }) {
  const [data, setData] = useState<TodayData | null>(initialData ?? null)
  const [error, setError] = useState('')
  const [traceId, setTraceId] = useState('trace_indisponivel')

  useEffect(() => {
    if (initialData) return
    const controller = new AbortController()
    fetch(appPath('/api/dashboard/today'), { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as TodayData & { error?: string; message?: string; traceId?: string }
        setTraceId(body.meta?.traceId ?? body.traceId ?? 'trace_indisponivel')
        if (!response.ok) throw new Error(body.message ?? body.error ?? 'Não foi possível carregar o Pulso.')
        setData(body)
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falha inesperada.') })
    return () => controller.abort()
  }, [initialData])

  const reload = () => { setError(''); setData(null); window.location.reload() }
  if (error) return <main className="bridge-page-content"><ModuleHeader eyebrow="Centro de comando" title="Pulso" subtitle="A operação não pôde ser lida neste momento." /><ErrorState traceId={traceId} runbook="/sistema/avancado/runbooks" message={error} onRetry={reload} /></main>
  if (!data) return <main className="bridge-page-content" aria-busy="true"><ModuleHeader eyebrow="Centro de comando" title="Pulso" subtitle="Carregando o trabalho editorial que precisa de atenção." /><KpiSkeleton count={4} /></main>

  const totalDecisions = data.decisions.review + data.decisions.radar + data.decisions.suggestions
  return <main className="bridge-page-content">
    <ModuleHeader eyebrow="Centro de comando" title="Pulso" subtitle={data.campaign ? `Acompanhe a próxima ação de ${data.campaign.name}.` : 'Centro de comando editorial.'} context={`Atualizado ${new Date(data.generatedAt).toLocaleTimeString('pt-BR')}`} actions={<button className="bridge-button" type="button" onClick={reload}>Atualizar</button>} />
    <MetricStrip metrics={[{ label: 'Decisões pendentes', value: totalDecisions, period: 'agora · fonte editorial', sourceStatus: 'ready', href: '/decisoes' }, { label: 'Slots editoriais', value: data.slots.length, period: 'próximas 24 horas', sourceStatus: 'ready', href: '/planejamento/conteudos' }, { label: 'Saúde da operação', value: 'Editorial', period: 'núcleo atual', sourceStatus: 'ready', href: '/sistema' }]} />
    <WorkspaceGrid main={<><header className="module-panel-header"><div><p className="module-eyebrow">Fluxo de trabalho</p><h2>O que precisa de decisão</h2></div><Link href="/decisoes">Ver fila completa →</Link></header><div className="module-list">{[['Revisão humana', data.decisions.review, '/decisoes/revisao'], ['Radar', data.decisions.radar, '/radar'], ['Sugestões editoriais', data.decisions.suggestions, '/planejamento/oportunidades']].map(([label, count, href]) => <Link href={String(href)} key={String(label)}><StatusBadge status={Number(count) > 0 ? 'DECIDIR' : 'LIMPO'} /><strong>{label}</strong><span>{count} item(ns) aguardando ação</span></Link>)}</div></>} rail={<><section><SectionHeader eyebrow="Agora" title="Próximas 24 horas" />{data.slots.length ? <div className="module-list">{data.slots.map((slot) => <article key={slot.id}><strong>{slot.title}</strong><span>{slot.channel} · {new Date(slot.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></article>)}</div> : <EmptyState message="Nenhum slot editorial previsto nas próximas 24 horas." />}</section><section><SectionHeader eyebrow="Atalhos" title="Próximas ações" /><ol>{data.actions.map((action) => <li key={action.href}><Link href={action.href}>{action.label}</Link></li>)}</ol></section><section><FreshnessLabel timestamp={data.generatedAt} source="dashboard/today" /></section></>} />
  </main>
}

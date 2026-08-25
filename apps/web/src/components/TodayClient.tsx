'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, KpiCard, KpiRow, PageHeader, StatusBadge } from '@plataforma/ui-bridge'
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
  if (error) return <main className="bridge-page-content"><PageHeader title="Pulso" subtitle="Centro de comando operacional." /><ErrorState traceId={traceId} runbook="/docs/runbooks/automations" onRetry={reload} /><p className="bridge-inline-notice" role="status">{error}</p></main>
  if (!data) return <main className="bridge-page-content" aria-busy="true"><PageHeader title="Pulso" subtitle="Carregando o trabalho que precisa de atenção." /></main>

  const totalDecisions = Object.values(data.decisions).reduce((sum, value) => sum + value, 0)
  const blocked = data.engines.filter((engine) => engine.state === 'error').length + data.failedQueues.filter((queue) => queue.failed !== 0).length
  return <main className="bridge-page-content">
    <PageHeader title="Pulso" subtitle={data.campaign ? `Centro de comando · ${data.campaign.name} · atualizado ${new Date(data.generatedAt).toLocaleTimeString('pt-BR')}` : 'Centro de comando operacional.'} actions={<button type="button" onClick={reload}>Atualizar</button>} />
    <KpiRow><KpiCard label="Decisões pendentes" value={totalDecisions} period="agora · fonte operacional" drillDownHref="/decisoes" /><KpiCard label="Publicações em 24h" value={data.slots.length} period="próximas 24 horas" drillDownHref="/planejamento/calendario" /><KpiCard label="Bloqueios atuais" value={blocked} period="incidentes não resolvidos" drillDownHref="/sistema/incidentes" /><KpiCard label="Saúde da operação" value={blocked ? 'Atenção' : 'Operacional'} period="estado real dos motores" drillDownHref="/sistema" /></KpiRow>

    <div className="module-workspace">
      <section className="module-main-panel"><header className="module-panel-header"><div><p className="module-eyebrow">Fluxo de trabalho</p><h2>O que precisa de decisão</h2></div><Link href="/decisoes">Ver fila completa →</Link></header><div className="module-list">
        {[['Revisão humana', data.decisions.review, '/decisoes/revisao'], ['Radar', data.decisions.radar, '/decisoes?view=radar'], ['Insights', data.decisions.insights, '/decisoes?view=insights'], ['Sugestões editoriais', data.decisions.suggestions, '/planejamento/oportunidades'], ['Engajamento', data.decisions.engagement, '/decisoes/engajamento']].map(([label, count, href]) => <Link href={String(href)} key={String(label)}><StatusBadge status={Number(count) > 0 ? 'DECIDIR' : 'LIMPO'} /><strong>{label}</strong><span>{count} item(ns) aguardando ação</span></Link>)}
        {data.engines.map((engine) => <article key={engine.key}><StatusBadge status={engine.state === 'error' ? 'BLOQUEADO' : 'ATENÇÃO'} /><strong>{engine.key} · {engine.name}</strong><span>{engine.title ?? 'O motor exige diagnóstico antes da próxima execução.'}{engine.nextAction ? ` ${engine.nextAction}` : ''}</span>{engine.traceId && <small>traceId: {engine.traceId}</small>}</article>)}
      </div></section>
      <aside className="module-rail"><section><p className="module-eyebrow">Agora</p><h2>Próximas 24 horas</h2>{data.slots.length ? <div className="module-list">{data.slots.map((slot) => <article key={slot.id}><strong>{slot.title}</strong><span>{slot.channel} · {new Date(slot.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></article>)}</div> : <EmptyState message="Nenhuma publicação prevista nas próximas 24 horas." />}</section><section><p className="module-eyebrow">Atalhos</p><h2>Próximas ações</h2><ol>{data.actions.map((action) => <li key={action.href}><Link href={action.href}>{action.label}</Link></li>)}</ol></section><section><p className="module-eyebrow">Tokens</p><h2>Integrações</h2>{data.expiringTokens.length ? data.expiringTokens.map((account) => <p key={account.id}>{account.username} vence em {new Date(account.expires_at).toLocaleDateString('pt-BR')}.</p>) : <p>Nenhum token expira nos próximos sete dias.</p>}</section></aside>
    </div>
  </main>
}


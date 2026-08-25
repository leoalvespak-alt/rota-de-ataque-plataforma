'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EmptyState, KpiCard, KpiRow, PageHeader, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

export type TodayData = {
  generatedAt: string
  campaign: { id: string; name: string } | null
  decisions: { review: number; radar: number; insights: number; suggestions: number; engagement: number }
  slots: Array<{ id: string; title: string; channel: string; scheduled_for: string }>
  engines: Array<{ key: string; name: string; state: 'attention' | 'error'; errors: number; divergent: number }>
  failedQueues: Array<{ name: string; failed: number }>
  expiringTokens: Array<{ id: string; username: string; role: string; expires_at: string }>
  actions: Array<{ label: string; href: string }>
}

export function TodayClient({ initialData }: { initialData?: TodayData }) {
  const [data, setData] = useState<TodayData | null>(initialData ?? null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) return
    const controller = new AbortController()
    fetch(appPath('/api/dashboard/today'), { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as TodayData & { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Não foi possível carregar o centro de comando.')
        setData(body)
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falha inesperada.') })
    return () => controller.abort()
  }, [initialData])

  if (error) return <main className="bridge-page-content"><PageHeader title="Hoje" subtitle="Centro de comando da operação." /><EmptyState message={error} /></main>
  if (!data) return <main className="bridge-page-content" aria-busy="true"><PageHeader title="Hoje" subtitle="Carregando centro de comando…" /></main>

  const totalDecisions = Object.values(data.decisions).reduce((sum, value) => sum + value, 0)
  const attention = data.engines.length + data.failedQueues.length + data.expiringTokens.length
  return <main className="bridge-page-content">
    <PageHeader title="Hoje" subtitle={data.campaign ? `Centro de comando · ${data.campaign.name}` : 'Centro de comando da operação.'} />
    <KpiRow><KpiCard label="Decisões pendentes" value={totalDecisions} /><KpiCard label="Vai ao ar em 24h" value={data.slots.length} /><KpiCard label="Itens de atenção" value={attention} trend={attention ? 'down' : 'neutral'} /></KpiRow>

    <section className="bridge-section"><h2>Decidir agora</h2><div className="bridge-card-grid">
      {[
        ['Revisão', data.decisions.review, '/decisoes?aba=revisao'], ['Radar', data.decisions.radar, '/decisoes?aba=radar'],
        ['Insights', data.decisions.insights, '/decisoes?aba=insights'], ['Sugestões', data.decisions.suggestions, '/decisoes?aba=sugestoes'],
        ['Engajamento', data.decisions.engagement, '/decisoes?aba=engajamento'],
      ].map(([label, count, href]) => <Link className="card" href={String(href)} key={String(label)}><strong>{label}</strong><span>{count} pendente{count === 1 ? '' : 's'}</span></Link>)}
    </div></section>

    <section className="bridge-section"><h2>Vai ao ar hoje</h2>{data.slots.length ? <div className="bridge-card-grid">{data.slots.map((slot) => <article className="card" key={slot.id}><strong>{slot.title}</strong><p>{slot.channel} · {new Date(slot.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p></article>)}</div> : <EmptyState message="Nenhuma publicação prevista nas próximas 24 horas." />}</section>

    <section className="bridge-section"><h2>Precisa de atenção</h2>{attention ? <div className="bridge-card-grid">
      {data.engines.map((engine) => <article className="card" key={engine.key}><StatusBadge status={engine.state === 'error' ? 'Erro' : 'Atenção'} /><strong>{engine.key} · {engine.name}</strong><p>{engine.errors} erro(s) · {engine.divergent} divergência(s)</p></article>)}
      {data.failedQueues.map((queue) => <article className="card" key={queue.name}><StatusBadge status={queue.failed < 0 ? 'Indisponível' : 'Erro'} /><strong>Fila {queue.name}</strong><p>{queue.failed < 0 ? 'Não foi possível consultar.' : `${queue.failed} job(s) falho(s).`}</p></article>)}
      {data.expiringTokens.map((account) => <article className="card" key={account.id}><StatusBadge status="Atenção" /><strong>{account.username}</strong><p>Token vence em {new Date(account.expires_at).toLocaleDateString('pt-BR')}.</p></article>)}
    </div> : <EmptyState message="Nenhuma atenção operacional pendente." />}</section>

    <section className="bridge-section"><h2>Próximas ações</h2><ol>{data.actions.map((action) => <li key={action.href}><Link href={action.href}>{action.label}</Link></li>)}</ol></section>
  </main>
}

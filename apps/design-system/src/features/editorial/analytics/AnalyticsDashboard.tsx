import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'

type Metrics = {
  contents: { total: number; approved: number; rejected: number; averageQuality: number | null }
  jobs: { total: number; failed: number; totalCost: string }
  thesisUsage: Array<{ title: string; count: number }>
}

type LoadState = 'loading' | 'error' | 'ready'

function metricNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatCost(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(amount) : 'Indisponível'
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<Metrics | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setState('loading')
    apiFetch<Metrics>('/metrics')
      .then((result) => {
        if (!active) return
        setData(result)
        setState('ready')
      })
      .catch(() => {
        if (!active) return
        setData(null)
        setState('error')
      })
    return () => { active = false }
  }, [retry])

  const averageQuality = typeof data?.contents.averageQuality === 'number' && Number.isFinite(data.contents.averageQuality) && data.contents.averageQuality >= 0 && data.contents.averageQuality <= 1
    ? `${Math.round(data.contents.averageQuality * 100)}%`
    : null

  return <section className="mx-auto max-w-5xl" aria-busy={state === 'loading'}>
    <h1 className="font-heading text-2xl font-bold text-ui-text">Métricas editoriais</h1>
    <p className="mt-1 text-sm text-ui-muted">Qualidade, aprovação, custo e distribuição de uso.</p>

    {state === 'loading' && <p role="status" className="mt-5 text-sm text-ui-muted">Carregando métricas editoriais…</p>}

    {state === 'error' && <div role="alert" className="mt-5 rounded-lg border border-red-800 bg-red-950/30 p-5 text-sm text-red-100">
      <p>Não foi possível carregar as métricas editoriais.</p>
      <p className="mt-1 text-red-200/80">Confira a conexão e tente novamente.</p>
      <button type="button" className="mt-4 rounded-md border border-red-700 px-3 py-2" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button>
    </div>}

    {state === 'ready' && data && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4"><h2 className="text-sm text-ui-muted">Conteúdos</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{metricNumber(data.contents.total)}</p></article>
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4"><h2 className="text-sm text-ui-muted">Aprovados</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{metricNumber(data.contents.approved)}</p></article>
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4"><h2 className="text-sm text-ui-muted">Rejeitados</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{metricNumber(data.contents.rejected)}</p></article>
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4"><h2 className="text-sm text-ui-muted">Qualidade média</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{averageQuality ?? 'Sem dados válidos'}</p></article>
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4"><h2 className="text-sm text-ui-muted">Gerações</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{metricNumber(data.jobs.total)}</p></article>
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4"><h2 className="text-sm text-ui-muted">Gerações com falha</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{metricNumber(data.jobs.failed)}</p></article>
        <article className="rounded-lg border border-ui-border bg-ui-panel p-4 sm:col-span-2"><h2 className="text-sm text-ui-muted">Custo registrado (unidade do provedor)</h2><p className="mt-2 text-2xl font-semibold text-ui-text">{formatCost(data.jobs.totalCost)}</p></article>
      </div>
      {data.thesisUsage.length > 0 && <section className="mt-6 rounded-lg border border-ui-border bg-ui-panel p-5">
        <h2 className="font-semibold text-ui-text">Uso por tese editorial</h2>
        <ul className="mt-3 space-y-2 text-sm text-ui-muted">{data.thesisUsage.map((item) => <li key={item.title} className="flex justify-between gap-4"><span>{item.title}</span><span>{metricNumber(item.count)}</span></li>)}</ul>
      </section>}
    </>}
  </section>
}

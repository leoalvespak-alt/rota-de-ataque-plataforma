'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button, EmptyState, ErrorState, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

type FunnelItem = { stage: string; id: string; title: string; status: string; entered_at: string; age_hours: number; locked: boolean; source_id: string | null; next_id: string | null; provenance: 'linked' | 'pending' | 'manual' | 'orphan' }
type FunnelStage = { stage: string; count: number; averageDwellHours: number; stuck: number; items: FunnelItem[] }
type FunnelData = { generatedAt: string; stages: FunnelStage[]; meta?: { traceId?: string } }
type FunnelResponse = FunnelData & { error?: string; message?: string; traceId?: string }

const labels: Record<string, string> = { suggestions: 'Sugestões', opportunities: 'Oportunidades', items: 'Conteúdos', variants: 'Variantes', publications: 'Publicações' }

export function FunnelBoard() {
  const [data, setData] = useState<FunnelData | null>(null)
  const [selected, setSelected] = useState('suggestions')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [traceId, setTraceId] = useState('trace_indisponivel')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(appPath('/api/content/funnel'), { cache: 'no-store' })
    const body = await response.json() as FunnelResponse
    setTraceId(body.meta?.traceId ?? body.traceId ?? 'trace_indisponivel')
    if (!response.ok) throw new Error(body.message ?? body.error ?? 'Não foi possível carregar o funil.')
    setData(body)
    setMessage('')
    setLoading(false)
  }, [])

  useEffect(() => { void load().catch((error) => { setMessage(error instanceof Error ? error.message : 'Falha inesperada.'); setLoading(false) }) }, [load])

  async function promote(item: FunnelItem) {
    const endpoint = item.stage === 'suggestions' ? `/api/admin/content-suggestions/${item.id}/action` : `/api/content-opportunities/${item.id}`
    const payload = item.stage === 'suggestions' ? { action: 'approve' } : { decision: 'approve' }
    setBusy(item.id)
    setMessage('')
    try {
      const response = await fetch(appPath(endpoint), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(body.message ?? body.error ?? 'Não foi possível promover o item.')
      setMessage('Item promovido com sucesso.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha inesperada.')
    } finally { setBusy(null) }
  }

  if (loading && !data) return <section className="bridge-section" aria-busy="true">Carregando funil editorial…</section>
  if (!data) return <section className="bridge-section"><ErrorState traceId={traceId} runbook="/docs/runbooks/system-health" onRetry={() => void load().catch((error) => { setMessage(error instanceof Error ? error.message : 'Falha inesperada.'); setLoading(false) })} /><p className="bridge-inline-notice" role="status">{message || 'A API do funil está indisponível. Verifique a migração e tente novamente.'}</p></section>

  const stage = data.stages.find((item) => item.stage === selected) ?? data.stages[0]
  return <section className="bridge-section">
    <div className="module-panel-header"><div><h2>Funil editorial</h2><p>Da pauta à publicação, com permanência calculada no timestamp de cada etapa.</p></div><small className="module-meta">Atualizado {new Date(data.generatedAt).toLocaleString('pt-BR')}</small></div>
    {message && <p role="status" className="bridge-inline-notice">{message}</p>}
    <div className="bridge-card-grid" role="list" aria-label="Estágios do funil">{data.stages.map((item) => <button key={item.stage} type="button" role="listitem" aria-pressed={item.stage === selected} className="card" onClick={() => setSelected(item.stage)} style={{ textAlign: 'left', borderColor: item.stage === selected ? 'var(--accent-primary)' : undefined }}><strong>{labels[item.stage] ?? item.stage}</strong><span>{item.count} itens</span><small>Média: {item.averageDwellHours}h · {item.stuck} travados</small></button>)}</div>
    {!stage || stage.items.length === 0 ? <EmptyState message="Nenhum item neste estágio." /> : <div style={{ overflowX: 'auto', marginTop: 16 }}><table><thead><tr><th>Item</th><th>Status</th><th>Proveniência</th><th>Permanência</th><th>Ação</th></tr></thead><tbody>{stage.items.map((item) => {
      const stuck = item.locked || item.age_hours >= 168
      return <tr key={item.id} style={{ background: stuck ? 'var(--status-warning-subtle)' : undefined }}><td><strong>{item.title}</strong>{stuck && <><br /><small>Travado {item.locked ? 'por proteção manual' : item.provenance === 'orphan' ? 'por transição sem próximo estágio' : 'há mais de 7 dias'}</small></>}</td><td><StatusBadge status={item.status} /></td><td><StatusBadge status={item.provenance} />{(item.source_id || item.next_id) && <small style={{ display: 'block' }}>{item.source_id ? 'origem ligada' : 'próximo estágio ligado'}</small>}</td><td>{item.age_hours}h</td><td>{item.stage === 'suggestions' || item.stage === 'opportunities' ? <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => void promote(item)}>Promover</Button> : item.stage === 'items' ? <Link href={`/planejamento/conteudos/${item.id}`}>Abrir</Link> : item.stage === 'publications' ? <Link href="/planejamento/calendario">Abrir calendário</Link> : <Link href="/planejamento/conteudos">Abrir conteúdo</Link>}</td></tr>
    })}</tbody></table></div>}
  </section>
}

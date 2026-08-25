'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button, EmptyState, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

type FunnelItem = { stage: string; id: string; title: string; status: string; entered_at: string; age_hours: number; locked: boolean; source_id: string | null; next_id: string | null; provenance: 'linked' | 'pending' | 'manual' | 'orphan' }
type FunnelStage = { stage: string; count: number; averageDwellHours: number; stuck: number; items: FunnelItem[] }
type FunnelData = { generatedAt: string; stages: FunnelStage[] }

const labels: Record<string, string> = { suggestions: 'Sugestões', opportunities: 'Oportunidades', items: 'Conteúdos', variants: 'Variantes', publications: 'Publicações' }

export function FunnelBoard() {
  const [data, setData] = useState<FunnelData | null>(null)
  const [selected, setSelected] = useState('suggestions')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(appPath('/api/content/funnel'), { cache: 'no-store' })
    const body = await response.json() as FunnelData & { error?: string }
    if (!response.ok) throw new Error(body.error ?? 'Não foi possível carregar o funil.')
    setData(body)
  }, [])

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Falha inesperada.')) }, [load])

  async function promote(item: FunnelItem) {
    const endpoint = item.stage === 'suggestions' ? `/api/admin/content-suggestions/${item.id}/action` : `/api/content-opportunities/${item.id}`
    const payload = item.stage === 'suggestions' ? { action: 'approve' } : { decision: 'approve' }
    setBusy(item.id); setMessage('')
    try {
      const response = await fetch(appPath(endpoint), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível promover o item.')
      setMessage('Item promovido com sucesso.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha inesperada.')
    } finally { setBusy(null) }
  }

  if (!data) return <section className="bridge-section" aria-busy="true">{message || 'Carregando funil editorial…'}</section>
  const stage = data.stages.find((item) => item.stage === selected) ?? data.stages[0]
  return <section className="bridge-section">
    <h2>Funil editorial</h2>
    <p>Da pauta à publicação, com destaque para itens parados há sete dias ou protegidos contra automação.</p>
    {message && <p role="status" className="bridge-inline-notice">{message}</p>}
    <div className="bridge-card-grid" role="list" aria-label="Estágios do funil">{data.stages.map((item) => <button
      key={item.stage} type="button" role="listitem" aria-pressed={item.stage === selected} className="card"
      onClick={() => setSelected(item.stage)} style={{ textAlign: 'left', borderColor: item.stage === selected ? 'var(--accent-primary)' : undefined }}
    ><strong>{labels[item.stage] ?? item.stage}</strong><span>{item.count} itens</span><small>Média: {item.averageDwellHours}h · {item.stuck} travados</small></button>)}</div>

    {!stage || stage.items.length === 0 ? <EmptyState message="Nenhum item neste estágio." /> : <div style={{ overflowX: 'auto', marginTop: 16 }}><table>
      <thead><tr><th>Item</th><th>Status</th><th>Proveniência</th><th>Permanência</th><th>Ação</th></tr></thead>
      <tbody>{stage.items.map((item) => {
        const stuck = item.locked || item.age_hours >= 168
        return <tr key={item.id} style={{ background: stuck ? 'var(--status-warning-subtle)' : undefined }}>
          <td><strong>{item.title}</strong>{stuck && <><br /><small>Travado {item.locked ? 'por proteção manual' : item.provenance === 'orphan' ? 'por transição sem próximo estágio' : 'há mais de 7 dias'}</small></>}</td>
          <td><StatusBadge status={item.status} /></td><td><StatusBadge status={item.provenance} />{(item.source_id || item.next_id) && <small style={{ display: 'block' }}>{item.source_id ? 'origem ligada' : 'próximo estágio ligado'}</small>}</td><td>{item.age_hours}h</td>
          <td>{item.stage === 'suggestions' || item.stage === 'opportunities' ? <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => void promote(item)}>Promover</Button>
            : item.stage === 'items' ? <Link href={`/content-items/${item.id}`}>Abrir</Link>
              : item.stage === 'publications' ? <Link href="/conteudo?aba=calendario">Abrir calendário</Link>
                : <Link href="/conteudo?aba=conteudos">Abrir conteúdo</Link>}</td>
        </tr>
      })}</tbody>
    </table></div>}
  </section>
}

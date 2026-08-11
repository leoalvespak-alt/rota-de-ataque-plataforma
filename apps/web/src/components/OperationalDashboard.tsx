'use client'

import { useEffect, useState } from 'react'
import { DataTable, EmptyState, ThreePaneLayout } from '@plataforma/ui-bridge'
import { MultichannelActions } from './MultichannelActions'

type Item = Record<string, unknown>
export function OperationalDashboard({ view, title, subtitle, pane = false }: { view: string; title: string; subtitle: string; pane?: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void fetch(`/api/dashboard/${view}`).then(async (response) => {
    if (!response.ok) throw new Error('Não foi possível carregar os dados')
    return response.json() as Promise<{ items: Item[] }>
  }).then((body) => setItems(body.items)).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Erro inesperado')) }, [view])
  const openCreative = async (id: string) => {
    const bridge = window.open('/creative-bridge', 'creative-bridge')
    if (!bridge) return
    const state: { message: unknown; ready: boolean } = { message: null, ready: false }
    const deliver = (event: MessageEvent) => {
      if (event.origin === location.origin && event.data?.type === 'creative-bridge-ready') {
        state.ready = true
        if (state.message) {
          bridge.postMessage(state.message, location.origin)
          window.removeEventListener('message', deliver)
        }
      }
    }
    window.addEventListener('message', deliver)
    state.message = await fetch(`/api/content-opportunities/${id}/creative`).then(async (response) => response.ok ? response.json() as Promise<unknown> : null)
    if (!state.message) { window.removeEventListener('message', deliver); return }
    if (state.ready) { bridge.postMessage(state.message, location.origin); window.removeEventListener('message', deliver) }
  }
  const table = !items?.length ? <EmptyState message={error ?? 'Nenhum dado disponível ainda.'} /> : <DataTable rows={items} rowKey={(row) => String(row.id ?? JSON.stringify(row))} renderRow={(row) => <div className="data-row">{Object.entries(row).slice(0, 7).map(([key, value]) => <span key={key}><strong>{key}</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</span>)}{view === 'content-opportunity' && typeof row.id === 'string' && <button onClick={() => void openCreative(String(row.id))}>Gerar criativo</button>}</div>} />
  return <section className="page"><header><h1>{title}</h1><p>{subtitle}</p></header><MultichannelActions view={view}/>{pane ? <ThreePaneLayout list={<p>{items?.length ?? 0} registros</p>} detail={table} context={<p>Dados atualizados sob demanda.</p>} /> : table}</section>
}

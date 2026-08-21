import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { CreativeForm } from './CreativeForm'

type Publication = {
  id: string
  title: string | null
  caption: string | null
  channel: string | null
  format: string | null
  status: string | null
  curation_status: string | null
  scheduled_for: string | null
  published_at: string | null
  batch_id: string | null
  thesis_id: string | null
  thesis_title: string | null
  approved_by: string | null
  origin: string | null
}

const CHANNEL_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  feed: 'Feed',
  stories: 'Stories',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ready: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  draft: 'bg-ui-panel2 text-ui-muted border-ui-border',
  planned: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function CalendarView() {
  const [items, setItems] = useState<Publication[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<Partial<Publication> | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const load = useCallback(() => {
    apiFetch<Publication[]>('/publications')
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o calendário.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const byChannel = useMemo(() => {
    const map = new Map<string, Publication[]>()
    for (const item of items) {
      const key = item.channel ?? 'outros'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [items])

  const approved = items.filter((item) => item.approved_by).length

  if (editingItem || isCreating) {
    return (
      <section className="mx-auto max-w-2xl space-y-5">
        <h2 className="font-heading text-xl font-bold text-ui-text">
          {isCreating ? 'Novo Criativo' : 'Editar Criativo'}
        </h2>
        <CreativeForm
          initialData={(editingItem || {}) as Partial<import('./CreativeForm').CreativeFormData>}
          onSave={() => {
            setEditingItem(null)
            setIsCreating(false)
            setLoading(true)
            load()
          }}
          onCancel={() => {
            setEditingItem(null)
            setIsCreating(false)
          }}
        />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ui-muted">Ciclo orgânico unificado</p>
          <h1 className="font-heading text-2xl font-bold text-ui-text">Calendário editorial</h1>
          <p className="mt-1 text-sm text-ui-muted">
            {items.length} criativos · {approved} aprovados · {items.filter((item) => item.status === 'published').length} publicados
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text hover:bg-ui-panel2"
            onClick={() => {
              setLoading(true)
              load()
            }}
          >
            Atualizar
          </button>
          <button
            className="rounded-md bg-ui-primary px-3 py-2 text-sm text-ui-panel hover:bg-ui-primary/90"
            onClick={() => setIsCreating(true)}
          >
            Novo Criativo
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}
      {loading ? (
        <p className="text-sm text-ui-muted">Carregando calendário…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ui-muted">Nenhum criativo encontrado.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {byChannel.map(([channel, list]) => (
            <div key={channel} className="space-y-2">
              <h2 className="font-heading text-lg font-semibold text-ui-text">
                {CHANNEL_LABEL[channel] ?? channel} <span className="text-sm text-ui-muted">({list.length})</span>
              </h2>
              <div className="space-y-2">
                {list.map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => setEditingItem(item)}
                    className="w-full text-left rounded-lg border border-ui-border bg-ui-panel p-3 hover:border-ui-primary/50 hover:bg-ui-panel2 transition-colors focus:outline-none focus:ring-2 focus:ring-ui-primary/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ui-text line-clamp-1">{item.title ?? item.caption?.slice(0, 60) ?? 'Sem título'}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_COLOR[item.status ?? 'draft'] ?? STATUS_COLOR.draft}`}>
                        {item.status ?? 'draft'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-ui-muted">
                      <div>
                        {formatDate(item.scheduled_for)}
                        {item.thesis_title ? ` · ${item.thesis_title}` : ''}
                        {item.format ? ` · ${item.format}` : ''}
                        {item.approved_by ? ' · aprovado' : ''}
                      </div>
                      {item.origin && (
                        <span className="rounded bg-ui-panel2 px-1 py-0.5 text-[10px] opacity-70">
                          {item.origin}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

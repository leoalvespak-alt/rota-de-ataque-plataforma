'use client'

import { useCallback, useEffect, useState } from 'react'
import { appPath } from '@/lib/base-path'

type InboxStatus = 'pending_triage' | 'needs_human_review' | 'triaged' | 'resolved' | 'expired'
type InboxEvent = {
  id: string
  channel: string
  eventKind: 'comment' | 'direct_message'
  contentType: string
  textContent: string | null
  contentTruncated: boolean
  providerEventAt: string | null
  replyWindowExpiresAt: string | null
  status: InboxStatus
  triageReason: string | null
  receivedAt: string
  redacted: boolean
}

const STATUS_LABELS: Record<InboxStatus, string> = {
  pending_triage: 'Aguardando triagem',
  needs_human_review: 'Revisão humana',
  triaged: 'Triado',
  resolved: 'Resolvido',
  expired: 'Expirado',
}

function formatDate(value: string | null) {
  if (!value) return 'Data indisponível'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function replyWindowLabel(event: InboxEvent) {
  if (event.eventKind === 'direct_message') return 'Prazo de resposta não calculado; envio bloqueado.'
  if (!event.replyWindowExpiresAt) return 'Prazo de resposta não disponível; envio bloqueado.'
  return Date.parse(event.replyWindowExpiresAt) > Date.now()
    ? `Resposta privada permitida até ${formatDate(event.replyWindowExpiresAt)}`
    : 'Janela de resposta privada encerrada'
}

export function SocialInboxClient() {
  const [status, setStatus] = useState<'all' | InboxStatus>('all')
  const [events, setEvents] = useState<InboxEvent[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchPage = useCallback(async (cursor: string | null, append: boolean, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: '30' })
    if (status !== 'all') params.set('status', status)
    if (cursor) params.set('cursor', cursor)
    const response = await fetch(appPath(`/api/inbox?${params}`), { cache: 'no-store', signal })
    if (!response.ok) throw new Error(response.status === 401 ? 'Sua sessão expirou.' : 'Não foi possível carregar a inbox.')
    const result = await response.json() as { events: InboxEvent[]; counts: Record<string, number>; nextCursor: string | null }
    setEvents((current) => append ? [...current, ...result.events] : result.events)
    setCounts(result.counts)
    setNextCursor(result.nextCursor)
    setError(null)
  }, [status])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetchPage(null, false, controller.signal)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao carregar a inbox.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [fetchPage, refreshKey])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try { await fetchPage(nextCursor, true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar mais itens.') }
    finally { setLoadingMore(false) }
  }

  return <main className="social-inbox-page" id="main-content" aria-labelledby="social-inbox-title">
    <header className="social-inbox-header">
      <div>
        <p className="module-eyebrow">Canais recebidos</p>
        <h1 id="social-inbox-title">Inbox social</h1>
        <p>Comentários e mensagens da conta do Instagram em uma fila com histórico e prazo de resposta.</p>
      </div>
      <button type="button" className="button-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
        Atualizar
      </button>
    </header>

    <section className="social-inbox-notice" aria-label="Estado da triagem">
      <strong>Triagem automática aguarda a credencial JEV.</strong>
      <span>Itens novos ficam para revisão humana. Esta tela não envia respostas.</span>
    </section>

    <section className="social-inbox-toolbar" aria-label="Filtros da inbox">
      <label htmlFor="social-inbox-status">Estado</label>
      <select id="social-inbox-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        <option value="all">Todos ({Object.values(counts).reduce((total, count) => total + count, 0)})</option>
        {(Object.keys(STATUS_LABELS) as InboxStatus[]).map((value) => (
          <option value={value} key={value}>{STATUS_LABELS[value]} ({counts[value] ?? 0})</option>
        ))}
      </select>
      <span>{events.length} item(ns) carregado(s)</span>
    </section>

    {error && <p className="social-inbox-error" role="alert">{error}</p>}
    {loading ? <p className="social-inbox-empty" role="status">Carregando eventos…</p> : events.length === 0
      ? <p className="social-inbox-empty">Nenhum evento encontrado neste filtro.</p>
      : <section className="social-inbox-list" aria-label="Eventos recebidos">
        {events.map((event) => <article className="social-inbox-event" key={event.id}>
          <header>
            <div>
              <span className="social-inbox-kind">{event.eventKind === 'comment' ? 'Comentário' : 'Mensagem direta'} · Instagram</span>
              <h2>{event.textContent ?? (event.contentType === 'attachment' ? 'Anexo recebido' : 'Evento sem texto')}</h2>
            </div>
            <span className={`social-inbox-status status-${event.status}`}>{STATUS_LABELS[event.status]}</span>
          </header>
          <p className="social-inbox-meta">Recebido em {formatDate(event.providerEventAt ?? event.receivedAt)}</p>
          {event.contentTruncated && <p className="social-inbox-meta">O texto foi reduzido ao limite de armazenamento desta fila.</p>}
          {event.redacted && <p className="social-inbox-meta">O conteúdo pessoal expirou e foi removido.</p>}
          {event.triageReason === 'jev_credential_pending' && <p className="social-inbox-meta">Revisão manual aguardando a credencial JEV.</p>}
          <p className="social-inbox-window">{replyWindowLabel(event)}</p>
        </article>)}
      </section>}

    {nextCursor && <div className="social-inbox-more"><button type="button" className="button-secondary" onClick={() => void loadMore()} disabled={loadingMore}>
      {loadingMore ? 'Carregando…' : 'Carregar mais'}
    </button></div>}
  </main>
}

'use client'

import { ChannelBadge, Dialog, EmptyState, InputField, KpiCard, KpiRow, PageHeader, SelectField, StatusBadge, TextareaField, type MultichannelName } from '@plataforma/ui-bridge'
import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

interface ContentStructure {
  roteiro?: string
  slides?: Array<{ ordem?: number; titulo?: string; texto?: string }>
  legenda_longa?: string
  observacoes?: string
}

interface Publication {
  id: string
  title: string
  caption: string | null
  channel: string
  subtype: string | null
  status: string
  scheduled_for: string | null
  origin: string
  locked_at: string | null
  thesis_id: string | null
  pillar: string | null
  format: string | null
  hashtags: string[] | null
  cta: string | null
  content_structure: ContentStructure | null
  external_id: string | null
}

const STATUSES = ['idea', 'draft', 'ready', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'awaiting_manual_publish']
const STATUS_LABELS: Record<string, string> = {
  idea: 'Ideia', draft: 'Rascunho', ready: 'Pronto', approved: 'Aprovado',
  scheduled: 'Agendado', publishing: 'Publicando', published: 'Publicado',
  failed: 'Falhou', awaiting_manual_publish: 'Aguardando manual',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  idea: ['draft'],
  draft: ['ready', 'idea'],
  ready: ['approved', 'draft'],
  approved: ['scheduled', 'ready'],
  scheduled: ['approved', 'cancelled'],
  failed: ['scheduled', 'draft'],
}

export function PublishingClient({ publications: initialPubs, scheduled, published, failed, pillars, formats }: {
  publications: Publication[]
  scheduled: number
  published: number
  failed: number
  pillars?: { name: string; slug: string }[]
  formats?: { format_name: string; slug: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'kanban'
  const [isPending, startTransition] = useTransition()
  const [publications, setPublications] = useState(initialPubs)
  const [editing, setEditing] = useState<Publication | null>(null)
  const [showBatch, setShowBatch] = useState(false)
  const [dragItem, setDragItem] = useState<string | null>(null)
  const [killSwitchActive, setKillSwitchActive] = useState<boolean | null>(null)
  const [killSwitchError, setKillSwitchError] = useState('')
  const [killSwitchOrigin, setKillSwitchOrigin] = useState('worker_settings')
  const [manualPublicationId, setManualPublicationId] = useState<string | null>(null)
  const [manualExternalId, setManualExternalId] = useState('')
  const [manualError, setManualError] = useState('')
  const [cancelPublicationId, setCancelPublicationId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [killDialogOpen, setKillDialogOpen] = useState(false)
  const [killReason, setKillReason] = useState('')
  const [killError, setKillError] = useState('')
  const [dialogBusy, setDialogBusy] = useState(false)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewType, setViewType] = useState<'month' | 'week'>('month')

  const loadKillSwitch = useCallback(async () => { try { const response = await fetch(appPath('/api/admin/publishing/kill-switch')); const raw = await response.text(); const body = raw && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(raw) as { active?: boolean; origin?: string; error?: string } : {}; if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`); setKillSwitchActive(Boolean(body.active)); setKillSwitchOrigin(typeof body.origin === 'string' ? body.origin : 'worker_settings'); setKillSwitchError('') } catch (error) { setKillSwitchActive(false); setKillSwitchError(error instanceof Error ? error.message : 'Não foi possível verificar o estado. A API continuará bloqueando saídas conforme o estado persistido.') } }, [])
  const toggleKillSwitch = useCallback(async () => { setKillError(''); setDialogBusy(true); try { const response = await fetch(appPath('/api/admin/publishing/kill-switch'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: killSwitchActive ? 'resume' : 'kill', reason: killReason.trim() }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setKillSwitchActive(Boolean(body.active)); setKillSwitchOrigin(typeof body.origin === 'string' ? body.origin : 'operator'); setKillDialogOpen(false); setKillReason(''); toast(body.active ? 'Publicação reativada' : 'Kill-switch ativado') } catch (error) { setKillError(error instanceof Error ? error.message : 'Não foi possível alterar o kill-switch') } finally { setDialogBusy(false) } }, [killReason, killSwitchActive])
  const confirmManual = useCallback(async () => { if (!manualPublicationId || !manualExternalId.trim()) { setManualError('Informe o ID externo da publicação.'); return } setManualError(''); setDialogBusy(true); try { const response = await fetch(appPath('/api/admin/publishing/confirm-manual'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicationId: manualPublicationId, externalId: manualExternalId.trim() }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setPublications(items => items.map(item => item.id === manualPublicationId ? { ...item, status: 'published', external_id: manualExternalId.trim() } : item)); setManualPublicationId(null); setManualExternalId(''); toast('Postagem confirmada') } catch (error) { setManualError(error instanceof Error ? error.message : 'Não foi possível confirmar a postagem') } finally { setDialogBusy(false) } }, [manualExternalId, manualPublicationId])
  const cancelPublication = useCallback(async () => { if (!cancelPublicationId || !cancelReason.trim()) { setCancelError('Informe o motivo do cancelamento.'); return } setCancelError(''); setDialogBusy(true); try { const response = await fetch(appPath('/api/admin/publishing/cancel'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicationId: cancelPublicationId, reason: cancelReason.trim() }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setPublications(items => items.map(item => item.id === cancelPublicationId ? { ...item, status: 'cancelled' } : item)); setCancelPublicationId(null); setCancelReason(''); toast('Publicação cancelada') } catch (error) { setCancelError(error instanceof Error ? error.message : 'Não foi possível cancelar a publicação') } finally { setDialogBusy(false) } }, [cancelPublicationId, cancelReason])

  useEffect(() => { void loadKillSwitch() }, [loadKillSwitch])

  const first = new Date(viewYear, viewMonth, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const days = Array.from({ length: viewType === 'month' ? 42 : 7 }, (_, index) => {
    const date = new Date(viewType === 'month' ? start : now)
    if (viewType === 'week') date.setDate(now.getDate() - now.getDay() + index)
    else date.setDate(start.getDate() + index)
    return date
  })

  function changeMode(nextMode: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextMode !== 'kanban') params.set('mode', nextMode); else params.delete('mode')
    startTransition(() => { router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false }) })
  }

  const savePublication = useCallback(async (pub: Partial<Publication> & { id?: string }): Promise<Publication | null> => {
    try {
      const res = await fetch(appPath('/api/admin/publications'), {
        method: pub.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pub),
      })
      if (!res.ok) { toast.error('Erro ao salvar'); return null }
      const data = await res.json()
      if (pub.id) {
        setPublications(prev => prev.map(p => p.id === pub.id ? { ...p, ...pub } as Publication : p))
      } else {
        setPublications(prev => [...prev, data.item])
      }
      setEditing(null)
      toast('Agendamento salvo')
      return data.item as Publication
    } catch { toast.error('Erro de rede'); return null }
  }, [])

  const moveStatus = useCallback(async (pubId: string, newStatus: string) => {
    const pub = publications.find(p => p.id === pubId)
    if (!pub) return
    const allowed = VALID_TRANSITIONS[pub.status]
    if (allowed && !allowed.includes(newStatus)) {
      toast.error(`Transição ${pub.status} → ${newStatus} não permitida`)
      return
    }
    try {
      const response = await fetch(appPath('/api/admin/publications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pubId, status: newStatus }),
      })
      if (!response.ok) { toast.error('Erro ao mover'); return }
      setPublications(prev => prev.map(p => p.id === pubId ? { ...p, status: newStatus } : p))
    } catch { toast.error('Erro ao mover') }
  }, [publications])

  const lockPublication = useCallback(async (pubId: string) => {
    try {
      const response = await fetch(appPath('/api/admin/publications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pubId, locked_at: new Date().toISOString() }),
      })
      if (!response.ok) { toast.error('Erro ao fixar'); return }
      setPublications(prev => prev.map(p => p.id === pubId ? { ...p, locked_at: new Date().toISOString() } : p))
      toast('Item fixado — protegido contra automação')
    } catch { toast.error('Erro ao fixar') }
  }, [])

  const handleDrop = useCallback((pubId: string, date: Date) => {
    savePublication({ id: pubId, scheduled_for: date.toISOString() })
    setDragItem(null)
  }, [savePublication])

  const emptyAction = publications.length === 0 ? (
    <EmptyState message="Nenhuma publicação ainda." action={
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
        <button className="bridge-button" data-variant="primary" onClick={() => setEditing({ id: '', title: '', caption: null, channel: 'instagram', subtype: null, status: 'idea', scheduled_for: null, origin: 'manual', locked_at: null, thesis_id: null, pillar: null, format: null, hashtags: null, cta: null, content_structure: null, external_id: null })}>
          Criar agendamento
        </button>
        <button className="bridge-button" data-variant="secondary" onClick={() => setShowBatch(true)}>
          Programar em lote
        </button>
        <button className="bridge-button" data-variant="ghost" onClick={() => router.push('/review-inbox')}>
          Revisar sugestões
        </button>
      </div>
    } />
  ) : null

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader title="Publicação multicanal" subtitle="Calendário editorial, fila de aprovação e comprovantes por canal" />
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="bridge-button" data-variant="primary" onClick={() => setEditing({ id: '', title: '', caption: null, channel: 'instagram', subtype: null, status: 'idea', scheduled_for: null, origin: 'manual', locked_at: null, thesis_id: null, pillar: null, format: null, hashtags: null, cta: null, content_structure: null, external_id: null })}>
            + Novo
          </button>
          <button className="bridge-button" data-variant="secondary" onClick={() => setShowBatch(true)}>
            Lote
          </button>
          <div style={{ display: 'flex', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button onClick={() => changeMode('kanban')} style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: mode === 'kanban' ? 'var(--accent-primary)' : 'transparent', color: mode === 'kanban' ? 'white' : 'var(--text-secondary)' }}>Kanban</button>
            <button onClick={() => changeMode('calendar')} style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: mode === 'calendar' ? 'var(--accent-primary)' : 'transparent', color: mode === 'calendar' ? 'white' : 'var(--text-secondary)' }}>Calendário</button>
          </div>
        </div>
      </div>
      <div className="bridge-inline-notice" role="status">{killSwitchActive === null ? 'Verificando kill-switch…' : killSwitchError ? `Não foi possível verificar o kill-switch: ${killSwitchError}` : killSwitchActive ? `Publicação habilitada · origem: ${killSwitchOrigin}` : `Kill-switch ativo: nenhuma saída será publicada · origem: ${killSwitchOrigin}`} <button className="bridge-button" data-variant={killSwitchActive ? 'danger' : 'primary'} onClick={() => { setKillError(''); setKillDialogOpen(true) }}>{killSwitchActive ? 'Ativar kill-switch' : 'Reativar publicação'}</button></div>

      <KpiRow>
        <KpiCard label="Agendadas" value={publications.filter(p => p.status === 'scheduled').length} />
        <KpiCard label="Publicadas" value={publications.filter(p => p.status === 'published').length} />
        <KpiCard label="Falhas" value={publications.filter(p => p.status === 'failed').length} />
        <KpiCard label="Canais" value={new Set(publications.map(p => p.channel)).size} />
      </KpiRow>

      <div style={{ flex: 1, overflowY: 'auto', marginTop: 'var(--space-4)' }}>
        {publications.length === 0 ? emptyAction : mode === 'calendar' ? (
          <section className="card" aria-label="Calendário">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="bridge-button" data-variant="ghost" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }}>&larr;</button>
                <h2 style={{ margin: 0 }}>{new Date(viewYear, viewMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                <button className="bridge-button" data-variant="ghost" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }}>&rarr;</button>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="bridge-button" data-variant={viewType === 'month' ? 'primary' : 'ghost'} onClick={() => setViewType('month')}>Mês</button>
                <button className="bridge-button" data-variant={viewType === 'week' ? 'primary' : 'ghost'} onClick={() => setViewType('week')}>Semana</button>
              </div>
            </div>
            <div className="calendar-grid">
              <p role="note" style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontSize: 'var(--text-sm, 0.875rem)' }}>Teclado: setas navegam pelos dias; Home/End vão ao início/fim; Enter edita. Também é possível usar “Reagendar” em cada publicação, sem arrastar.</p>
              {days.map(day => {
                const dayPubs = publications.filter(item => item.scheduled_for && new Date(item.scheduled_for).toDateString() === day.toDateString())
                return (
                  <article
                    className="calendar-day"
                    key={day.toISOString()}
                    tabIndex={0}
                    onKeyDown={event => { if (event.key === 'Enter' && dayPubs[0]) setEditing(dayPubs[0]); if (event.key === 'Escape') setDragItem(null); if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') { event.preventDefault(); const currentIndex = days.indexOf(day); const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1 : currentIndex + (event.key === 'ArrowRight' ? 1 : -1); (event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.calendar-day')[nextIndex])?.focus() } }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (dragItem) handleDrop(dragItem, day) }}
                    style={{ minHeight: viewType === 'week' ? '120px' : undefined }}
                  >
                    <strong style={{ color: day.getMonth() !== viewMonth ? 'var(--text-disabled)' : undefined }}>{day.getDate()}</strong>
                    {dayPubs.map(item => (
                      <small
                        key={item.id}
                        draggable
                        onDragStart={() => setDragItem(item.id)}
                        onClick={() => setEditing(item)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', padding: '2px 4px', background: 'var(--surface-overlay)', borderRadius: '4px', cursor: 'grab', borderLeft: item.locked_at ? '3px solid var(--accent-primary)' : undefined }}
                      >
                        <ChannelBadge channel={item.channel as MultichannelName} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.caption?.slice(0, 30) || 'Sem título'}</span>
                        <button type="button" className="bridge-button" data-variant="quiet" aria-label={`Reagendar ${item.title || 'publicação'}`} onClick={(event) => { event.stopPropagation(); setEditing(item) }}>Reagendar</button>
                        {item.content_structure?.roteiro || item.content_structure?.legenda_longa ? <span title="Copy preenchida" style={{ fontSize: '10px', color: 'var(--status-success)' }}>✓copy</span> : <span title="Copy faltando" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>copy?</span>}
                        {item.locked_at && <span title="Fixado">🔒</span>}
                        {item.status === 'awaiting_manual_publish' && <button className="bridge-button" data-variant="primary" onClick={(event) => { event.stopPropagation(); setManualError(''); setManualExternalId(item.external_id ?? ''); setManualPublicationId(item.id) }}>Confirmar</button>}
                        {item.status === 'scheduled' && item.scheduled_for && new Date(item.scheduled_for).getTime() - Date.now() <= 600_000 && new Date(item.scheduled_for).getTime() > Date.now() && <button className="bridge-button" data-variant="quiet" onClick={(event) => { event.stopPropagation(); setCancelError(''); setCancelReason(''); setCancelPublicationId(item.id) }}>Cancelável (10 min)</button>}
                      </small>
                    ))}
                  </article>
                )
              })}
            </div>
          </section>
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px' }}>
            {STATUSES.map(status => (
              <div
                key={status}
                style={{ minWidth: '220px', flex: '0 0 220px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: '12px' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragItem) moveStatus(dragItem, status) }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px' }}>{STATUS_LABELS[status] ?? status}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>{publications.filter(p => p.status === status).length}</span>
                </div>
                {publications.filter(p => p.status === status).map(item => (
                  <article
                    key={item.id}
                    draggable
                    onDragStart={() => setDragItem(item.id)}
                    onClick={() => setEditing(item)}
                    className="card"
                    style={{ marginBottom: '8px', cursor: 'grab', borderLeft: item.locked_at ? '3px solid var(--accent-primary)' : undefined, padding: '8px' }}
                  >
                    <header style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <ChannelBadge channel={item.channel as MultichannelName} />
                      {item.origin === 'manual' && <span style={{ fontSize: '10px', padding: '1px 4px', background: 'var(--surface-overlay)', borderRadius: '4px' }}>manual</span>}
                      {item.locked_at && <span title="Fixado">🔒</span>}
                    </header>
                    <strong style={{ fontSize: '13px', display: 'block' }}>{item.title || item.caption?.slice(0, 40) || 'Sem título'}</strong>
                    {item.scheduled_for && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{new Date(item.scheduled_for).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}
                    {item.pillar && <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>{item.pillar}</span>}
                  </article>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <SlotEditor
          publication={editing}
          pillars={pillars ?? []}
          formats={formats ?? []}
          onSave={savePublication}
          onLock={lockPublication}
          onClose={() => setEditing(null)}
        />
      )}

      {showBatch && (
        <BatchScheduler
          pillars={pillars ?? []}
          formats={formats ?? []}
          existingPubs={publications}
          onGenerate={async (items) => {
            const persisted = (await Promise.all(items.map(item => savePublication(item)))).filter((item): item is Publication => Boolean(item))
            if (persisted.length === items.length) { setShowBatch(false); toast(`${items.length} slots persistidos`) }
          }}
          onClose={() => setShowBatch(false)}
        />
      )}
      <Dialog open={manualPublicationId !== null} onOpenChange={(open) => { if (!open && !dialogBusy) setManualPublicationId(null) }} title="Confirmar publicação manual">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}><InputField label="ID externo da publicação" value={manualExternalId} onChange={(event) => setManualExternalId(event.target.value)} description="Informe o identificador retornado pelo canal." error={manualError} autoFocus /><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}><button className="bridge-button" data-variant="quiet" disabled={dialogBusy} onClick={() => setManualPublicationId(null)}>Cancelar</button><button className="bridge-button" data-variant="primary" disabled={dialogBusy} onClick={() => void confirmManual()}>{dialogBusy ? 'Enviando…' : 'Confirmar'}</button></div></div>
      </Dialog>
      <Dialog open={cancelPublicationId !== null} onOpenChange={(open) => { if (!open && !dialogBusy) setCancelPublicationId(null) }} title="Cancelar publicação">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}><TextareaField label="Motivo do cancelamento" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} description="Obrigatório para a auditoria." error={cancelError} rows={4} autoFocus /><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}><button className="bridge-button" data-variant="quiet" disabled={dialogBusy} onClick={() => setCancelPublicationId(null)}>Voltar</button><button className="bridge-button" data-variant="danger" disabled={dialogBusy} onClick={() => void cancelPublication()}>{dialogBusy ? 'Cancelando…' : 'Cancelar publicação'}</button></div></div>
      </Dialog>
      <Dialog open={killDialogOpen} onOpenChange={(open) => { if (!open && !dialogBusy) setKillDialogOpen(false) }} title={killSwitchActive ? 'Reativar publicação' : 'Ativar kill-switch'}>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}><TextareaField label="Motivo da alteração" value={killReason} onChange={(event) => setKillReason(event.target.value)} description="Obrigatório para a trilha operacional." error={killError} rows={4} autoFocus /><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}><button className="bridge-button" data-variant="quiet" disabled={dialogBusy} onClick={() => setKillDialogOpen(false)}>Voltar</button><button className="bridge-button" data-variant={killSwitchActive ? 'primary' : 'danger'} disabled={dialogBusy} onClick={() => void toggleKillSwitch()}>{dialogBusy ? 'Salvando…' : killSwitchActive ? 'Reativar' : 'Ativar kill-switch'}</button></div></div>
      </Dialog>
    </main>
  )
}

function SlotEditor({ publication, pillars, formats, onSave, onLock, onClose }: {
  publication: Publication
  pillars: { name: string; slug: string }[]
  formats: { format_name: string; slug: string }[]
  onSave: (pub: Partial<Publication> & { id?: string }) => void
  onLock: (id: string) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(publication)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={form.id ? 'Editar agendamento' : 'Novo agendamento'}>
      <div style={{ maxHeight: '70vh', overflowY: 'auto', display: 'grid', gap: 'var(--space-3)' }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          <InputField label="Título" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <InputField type="datetime-local" label="Data/Hora" value={form.scheduled_for?.slice(0, 16) ?? ''} onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            <SelectField label="Canal" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                <option value="instagram">Instagram</option>
                <option value="threads">Threads</option>
            </SelectField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <SelectField label="Formato" value={form.subtype ?? ''} onChange={e => setForm(f => ({ ...f, subtype: e.target.value || null }))}>
                <option value="">—</option>
                <option value="reels">Reels</option>
                <option value="carousel">Carrossel</option>
                <option value="feed">Feed</option>
                <option value="stories">Stories</option>
                <option value="static">Estático</option>
                <option value="threads">Threads</option>
            </SelectField>
            <SelectField label="Pilar" value={form.pillar ?? ''} onChange={e => setForm(f => ({ ...f, pillar: e.target.value || null }))}>
                <option value="">—</option>
                {pillars.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </SelectField>
          </div>
          <TextareaField label="Legenda" value={form.caption ?? ''} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} rows={4} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <InputField label="CTA" value={form.cta ?? ''} onChange={e => setForm(f => ({ ...f, cta: e.target.value }))} />
            <InputField label="Hashtags" value={form.hashtags?.join(' ') ?? ''} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value.split(/\s+/).filter(Boolean) }))} placeholder="#concurso #policia" />
          </div>
          <details style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Copy {form.content_structure?.roteiro || form.content_structure?.legenda_longa ? '✓' : '(vazio)'}
            </summary>
            <div style={{ display: 'grid', gap: '12px', marginTop: 'var(--space-2)' }}>
              <TextareaField label="Roteiro / Copy longa" value={form.content_structure?.roteiro ?? ''} onChange={e => setForm(f => ({ ...f, content_structure: { ...f.content_structure, roteiro: e.target.value } }))} rows={6} />
              <TextareaField label="Legenda longa (além do limite do caption)" value={form.content_structure?.legenda_longa ?? ''} onChange={e => setForm(f => ({ ...f, content_structure: { ...f.content_structure, legenda_longa: e.target.value } }))} rows={4} />
              <TextareaField label="Observações para o editor" value={form.content_structure?.observacoes ?? ''} onChange={e => setForm(f => ({ ...f, content_structure: { ...f.content_structure, observacoes: e.target.value } }))} rows={3} />
              {(form.content_structure?.slides ?? []).map((slide, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px', display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px' }}>Slide {idx + 1}</strong>
                    <button type="button" style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, content_structure: { ...f.content_structure, slides: (f.content_structure?.slides ?? []).filter((_, i) => i !== idx) } }))}>Remover</button>
                  </div>
                  <InputField label="Título" value={slide.titulo} onChange={e => setForm(f => { const slides = [...(f.content_structure?.slides ?? [])]; slides[idx] = { ...slides[idx], titulo: e.target.value }; return { ...f, content_structure: { ...f.content_structure, slides } } })} />
                  <TextareaField label="Texto" value={slide.texto} onChange={e => setForm(f => { const slides = [...(f.content_structure?.slides ?? [])]; slides[idx] = { ...slides[idx], texto: e.target.value }; return { ...f, content_structure: { ...f.content_structure, slides } } })} rows={3} />
                </div>
              ))}
              <button type="button" className="bridge-button" data-variant="ghost" onClick={() => setForm(f => ({ ...f, content_structure: { ...f.content_structure, slides: [...(f.content_structure?.slides ?? []), { ordem: (f.content_structure?.slides?.length ?? 0) + 1, titulo: '', texto: '' }] } }))}>+ Adicionar slide</button>
            </div>
          </details>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <div>
            {form.id && !form.locked_at && (
              <button className="bridge-button" data-variant="secondary" onClick={() => onLock(form.id)}>Fixar (proteger)</button>
            )}
            {form.locked_at && <span style={{ fontSize: '12px', color: 'var(--accent-primary)' }}>🔒 Fixado</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="bridge-button" data-variant="ghost" onClick={onClose}>Cancelar</button>
            <button className="bridge-button" data-variant="primary" onClick={() => onSave(form)}>Salvar</button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function BatchScheduler({ pillars, formats, existingPubs, onGenerate, onClose }: {
  pillars: { name: string; slug: string }[]
  formats: { format_name: string; slug: string }[]
  existingPubs: Publication[]
  onGenerate: (items: Array<Omit<Publication, 'id'>>) => Promise<void>
  onClose: () => void
}) {
  const [days, setDays] = useState(7)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [pattern, setPattern] = useState('balanced')

  const generate = () => {
    const items: Array<Omit<Publication, 'id'>> = []
    const editorialPillars = pillars.map((pillar, index) => ({
      slug: pillar.slug,
      format: formats[index % Math.max(formats.length, 1)]?.slug ?? 'feed',
    }))
    if (!editorialPillars.length) return

    const start = new Date(startDate)
    for (let d = 0; d < days; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + d)
      const dateStr = date.toDateString()

      const existing = existingPubs.filter(p => p.scheduled_for && new Date(p.scheduled_for).toDateString() === dateStr)
      if (existing.length >= 2) continue

      const pillar = editorialPillars[d % editorialPillars.length]!
      const hour = [7, 12, 19][d % 3]!
      date.setHours(hour, 0, 0, 0)

      items.push({
        title: '',
        caption: null,
        channel: 'instagram',
        subtype: pillar.format as any,
        status: 'idea',
        scheduled_for: date.toISOString(),
        origin: 'manual',
        locked_at: null,
        thesis_id: null,
        pillar: pillar.slug,
        format: pillar.format,
        hashtags: null,
        cta: null,
        external_id: null,
        content_structure: null,
      })
    }

    void onGenerate(items)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title="Programação em lote">
        <div style={{ display: 'grid', gap: '12px' }}>
          <InputField type="date" label="Data inicial" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <InputField type="number" min={1} max={30} label="Número de dias" value={days} onChange={e => setDays(Number(e.target.value))} />
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Gera slots a partir dos pilares e formatos configurados no banco. Slots já preenchidos são preservados e cada slot é salvo antes de aparecer no calendário.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button className="bridge-button" data-variant="ghost" onClick={onClose}>Cancelar</button>
          <button className="bridge-button" data-variant="primary" onClick={generate}>Gerar {days} dias</button>
        </div>
    </Dialog>
  )
}

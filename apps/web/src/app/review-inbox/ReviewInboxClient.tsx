'use client'

import { Dialog, EmptyState, InputField, KpiCard, KpiRow, PageHeader, PriorityChip, TabArrowButtons, TextareaField, ThreePaneLayout } from '@plataforma/ui-bridge'
import { toast } from '@plataforma/ui-bridge'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { appPath } from '@/lib/base-path'
import { useSearchParams } from 'next/navigation'
import { ContentCopyFields, type ContentStructure } from '../publishing/ContentCopyFields'

interface ReviewItem {
  id: string
  item_type: string
  reason: string | null
  suggested_action: Record<string, unknown>
  context: Record<string, unknown>
  created_at: string
  risk_level?: 'P0' | 'P1' | 'P2' | 'P3'
  previous_state?: Record<string, unknown>
  decision_version?: number
  undo_token?: string | null
  undo_until?: string | null
}

interface RadarFinding {
  id: string
  title: string
  summary: string | null
  source_url: string | null
  source_name: string | null
  concurso_alvo: string | null
  estado: string | null
  banca: string | null
  fase_ciclo: string | null
  relevance_score: number
  created_at: string
  campaign_id: string | null
}

interface CompetitorInsight { id: string; competitor_handle: string; insight_type: string; title: string; description: string | null; hypothesis: string | null; evidence: Record<string, unknown>; metrics: Record<string, unknown>; is_outlier: boolean; outlier_multiplier: number | null; created_at: string }
interface ContentSuggestion { id: string; source_type: string; title: string; description: string | null; suggested_format: string | null; suggested_channel: string | null; pillar: string | null; thesis_id: string | null; campaign_id: string | null; evidence: Record<string, unknown>; curation_status: string; created_at: string }

function cleanContentStructure(value: ContentStructure): ContentStructure {
  const cleaned: ContentStructure = {}
  const textFields: Array<keyof Pick<ContentStructure, 'copy_principal' | 'roteiro' | 'texto_arte' | 'legenda_longa' | 'observacoes'>> = ['copy_principal', 'roteiro', 'texto_arte', 'legenda_longa', 'observacoes']
  for (const field of textFields) {
    const text = value[field]?.trim()
    if (text) cleaned[field] = text
  }
  const slides = (value.slides ?? []).map((slide, index) => ({ ordem: index + 1, titulo: slide.titulo?.trim() ?? '', texto: slide.texto?.trim() ?? '' })).filter((slide) => slide.titulo || slide.texto)
  if (slides.length) cleaned.slides = slides
  const stories = (value.stories ?? []).map((story, index) => ({ ordem: index + 1, texto: story.texto?.trim() ?? '', sticker: story.sticker?.trim() || undefined })).filter((story) => story.texto || story.sticker)
  if (stories.length) cleaned.stories = stories
  return cleaned
}

function label(value: string) { return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase()) }

function ReadableRecord({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value)
  return entries.length ? <dl className="record-list">{entries.map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd>{item && typeof item === 'object' ? Object.entries(item as Record<string, unknown>).map(([nested, nestedValue]) => `${label(nested)}: ${String(nestedValue)}`).join(' · ') : String(item ?? '—')}</dd></div>)}</dl> : <p>Nenhuma informação adicional.</p>
}

function DiffViewer({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
  return <div className="diff-viewer">{allKeys.map((key) => { const previous = before[key]; const next = after[key]; if (previous === next) return null; return <div key={key} className="diff-row" style={{ marginBottom: 'var(--space-4)' }}><strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>{label(key)}</strong><div style={{ display: 'flex', gap: 'var(--space-2)' }}><div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--status-error-subtle)', borderLeft: '2px solid var(--status-error)' }}><del style={{ color: 'var(--status-error-strong)', textDecoration: 'none' }}>{String(previous ?? '(vazio)')}</del></div><div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--status-success-subtle)', borderLeft: '2px solid var(--status-success)' }}><ins style={{ color: 'var(--status-success-strong)', textDecoration: 'none' }}>{String(next ?? '(vazio)')}</ins></div></div></div> })}</div>
}

const TABS = ['inbox', 'radar', 'insights', 'suggestions'] as const
type Tab = typeof TABS[number]
type DialogKind = 'slot' | 'dismiss-radar' | 'edit-suggestion' | 'reject-suggestion'

export function ReviewInboxClient({ initialItems, decidedToday, radarFindings = [], competitorInsights = [], contentSuggestions = [] }: { initialItems: ReviewItem[]; decidedToday: number; radarFindings?: RadarFinding[]; competitorInsights?: CompetitorInsight[]; contentSuggestions?: ContentSuggestion[] }) {
  const requestedTab = useSearchParams().get('aba')
  const initialTab: Tab = requestedTab === 'radar' || requestedTab === 'insights' ? requestedTab : requestedTab === 'sugestoes' ? 'suggestions' : 'inbox'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [items, setItems] = useState(() => [...initialItems].sort((a, b) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[a.risk_level ?? 'P3'] ?? 4) - ({ P0: 0, P1: 1, P2: 2, P3: 3 }[b.risk_level ?? 'P3'] ?? 4)))
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [notes, setNotes] = useState('')
  const [radar, setRadar] = useState(radarFindings)
  const [insights, setInsights] = useState(competitorInsights)
  const [suggestions, setSuggestions] = useState(contentSuggestions)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<RadarFinding | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<ContentSuggestion | null>(null)
  const [slotTitle, setSlotTitle] = useState('')
  const [slotCaption, setSlotCaption] = useState('')
  const [slotChannel, setSlotChannel] = useState<'instagram' | 'threads'>('instagram')
  const [slotScheduledFor, setSlotScheduledFor] = useState('')
  const [suggestionTitle, setSuggestionTitle] = useState('')
  const [suggestionDescription, setSuggestionDescription] = useState('')
  const [suggestionCaption, setSuggestionCaption] = useState('')
  const [suggestionHashtags, setSuggestionHashtags] = useState('')
  const [suggestionCta, setSuggestionCta] = useState('')
  const [suggestionFormat, setSuggestionFormat] = useState('reels')
  const [suggestionChannel, setSuggestionChannel] = useState<'instagram' | 'threads'>('instagram')
  const [suggestionScheduledFor, setSuggestionScheduledFor] = useState('')
  const [suggestionCopy, setSuggestionCopy] = useState<ContentStructure>({})
  const [dialogReason, setDialogReason] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [dialogBusy, setDialogBusy] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')
  const current = items[index]
  const tabIndex = TABS.indexOf(activeTab)

  const postOrganicAction = useCallback(async (path: string, body: Record<string, unknown>, onSuccess: () => void): Promise<boolean> => {
    try {
      const response = await fetch(appPath(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível concluir a ação')
      onSuccess()
      setLiveMessage('Ação registrada.')
      toast.success('Ação registrada.')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado'
      setDialogError(message)
      toast.error(message)
      return false
    }
  }, [])

  const undoReview = useCallback(async (removed: ReviewItem) => {
    if (!removed.undo_token || removed.decision_version === undefined) return
    try {
      const response = await fetch(appPath(`/api/review-inbox/${removed.id}/undo`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ undoToken: removed.undo_token, version: removed.decision_version }) })
      const result = await response.json().catch(() => ({})) as { item?: ReviewItem; error?: string }
      if (!response.ok || !result.item) throw new Error(result.error ?? 'Não foi possível desfazer')
      setItems((value) => [result.item!, ...value.filter((item) => item.id !== result.item!.id)])
      setIndex(0)
      setLiveMessage('Ação desfeita; item devolvido à fila.')
      toast.success('Ação desfeita.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro inesperado') }
  }, [])

  const decide = useCallback(async (action: 'approve' | 'edit' | 'reject' | 'block' | 'snooze' | 'skip') => {
    if (!current || busy) return
    if (action === 'skip') { setIndex((value) => Math.min(items.length - 1, value + 1)); setLiveMessage('Item pulado.'); toast('Item pulado.'); return }
    if (action === 'edit' && !editing) { setEditedText(String(current.suggested_action.text ?? '')); setEditing(true); return }
    setBusy(true)
    try {
      const payload: Record<string, unknown> = { notes: notes || undefined }
      if (action === 'snooze') payload.snoozeUntil = new Date(Date.now() + 86_400_000).toISOString()
      if (action === 'edit') payload.suggestedAction = { ...current.suggested_action, text: editedText }
      const response = await fetch(appPath(`/api/review-inbox/${current.id}/${action}`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json().catch(() => ({})) as { item?: ReviewItem; error?: string; replay?: boolean }
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível registrar a decisão')
      if (action === 'edit' && body.item) {
        setItems((value) => value.map((item) => item.id === current.id ? body.item! : item))
        setEditing(false)
        setLiveMessage('Sugestão atualizada.')
        toast.success('Sugestão atualizada com sucesso.')
      } else {
        const removed = { ...current, ...(body.item ?? {}) }
        setItems((value) => value.filter((item) => item.id !== current.id))
        setIndex(0)
        setLiveMessage(`Ação '${action}' registrada.`)
        toast.success(`Ação '${action}' registrada.`, { action: { label: 'Desfazer', onClick: () => void undoReview(removed) } })
      }
      setNotes('')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro inesperado') } finally { setBusy(false) }
  }, [busy, current, editedText, editing, items.length, notes, undoReview])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input,textarea,select,button')) return
      const key = event.key.toLowerCase()
      if (key === 'a') void decide('approve'); else if (key === 'e') void decide('edit'); else if (key === 'r') void decide('reject'); else if (key === 'b') void decide('block'); else if (key === 's') void decide('skip'); else if (key === '.') void decide('snooze'); else if (key === 'j') setIndex((value) => Math.min(items.length - 1, value + 1)); else if (key === 'k') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [decide, items.length])

  const openSlotEditor = useCallback((finding: RadarFinding) => {
    setSelectedFinding(finding); setSlotTitle(finding.title); setSlotCaption(finding.summary ?? finding.title); setSlotChannel('instagram'); setDialogReason(''); setDialogError('')
    const scheduled = new Date(Date.now() + 60 * 60_000)
    setSlotScheduledFor(new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
    setDialog('slot')
  }, [])

  const openSuggestionDialog = useCallback((kind: 'edit-suggestion' | 'reject-suggestion', suggestion: ContentSuggestion) => {
    setSelectedSuggestion(suggestion); setSuggestionTitle(suggestion.title); setSuggestionDescription(suggestion.description ?? ''); setSuggestionCaption(suggestion.description ?? suggestion.title); setSuggestionHashtags(''); setSuggestionCta(''); setSuggestionFormat(suggestion.suggested_format ?? 'reels'); setSuggestionChannel(suggestion.suggested_channel === 'threads' ? 'threads' : 'instagram'); setSuggestionScheduledFor(''); setSuggestionCopy({}); setDialogReason(''); setDialogError(''); setDialog(kind)
  }, [])

  const submitDialog = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (dialogBusy) return
    setDialogError(''); setDialogBusy(true)
    try {
      let ok = false
      if (dialog === 'slot' && selectedFinding) {
        if (!slotTitle.trim() || !slotCaption.trim() || !slotScheduledFor) throw new Error('Preencha título, conteúdo e horário.')
        ok = await postOrganicAction(`/api/admin/radar-findings/${selectedFinding.id}/action`, { action: 'approve', title: slotTitle.trim(), caption: slotCaption.trim(), channel: slotChannel, scheduledFor: new Date(slotScheduledFor).toISOString(), campaignId: selectedFinding.campaign_id }, () => setRadar((rows) => rows.filter((row) => row.id !== selectedFinding.id)))
      } else if (dialog === 'dismiss-radar' && selectedFinding) {
        ok = await postOrganicAction(`/api/admin/radar-findings/${selectedFinding.id}/action`, { action: 'dismiss', reason: dialogReason.trim() || undefined }, () => setRadar((rows) => rows.filter((row) => row.id !== selectedFinding.id)))
      } else if (dialog === 'edit-suggestion' && selectedSuggestion) {
        if (!suggestionTitle.trim()) throw new Error('Informe um título.')
        const scheduledFor = suggestionScheduledFor ? new Date(suggestionScheduledFor).toISOString() : undefined
        if (scheduledFor && new Date(scheduledFor).getTime() <= Date.now()) throw new Error('Escolha um horário futuro.')
        ok = await postOrganicAction(`/api/admin/content-suggestions/${selectedSuggestion.id}/action`, { action: 'edit-approve', title: suggestionTitle.trim(), description: suggestionDescription.trim() || undefined, caption: suggestionCaption.trim() || undefined, hashtags: suggestionHashtags.split(/[\n,]/u).map((tag) => tag.trim().replace(/^#/u, '')).filter(Boolean), cta: suggestionCta.trim() || undefined, format: suggestionFormat, channel: suggestionChannel, contentStructure: cleanContentStructure(suggestionCopy), scheduledFor }, () => setSuggestions((rows) => rows.filter((row) => row.id !== selectedSuggestion.id)))
      } else if (dialog === 'reject-suggestion' && selectedSuggestion) {
        ok = await postOrganicAction(`/api/admin/content-suggestions/${selectedSuggestion.id}/action`, { action: 'reject', rejectionReason: dialogReason.trim() || undefined }, () => setSuggestions((rows) => rows.filter((row) => row.id !== selectedSuggestion.id)))
      }
      if (ok) setDialog(null)
    } catch (error) { setDialogError(error instanceof Error ? error.message : 'Não foi possível concluir a ação') } finally { setDialogBusy(false) }
  }, [dialog, dialogBusy, dialogReason, postOrganicAction, selectedFinding, selectedSuggestion, slotCaption, slotChannel, slotScheduledFor, slotTitle, suggestionCaption, suggestionCta, suggestionCopy, suggestionDescription, suggestionFormat, suggestionHashtags, suggestionScheduledFor, suggestionTitle, suggestionChannel])

  return <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <PageHeader title="Review Inbox" subtitle="Triagem humana com contexto legível e trilha de auditoria" />
    <KpiRow><KpiCard label="Pendentes" value={items.length} /><KpiCard label="Decididos hoje" value={decidedToday} /></KpiRow>
    <div className="bridge-tab-navigation" style={{ width: 'fit-content' }}><TabArrowButtons previous={tabIndex > 0 ? { label: label(TABS[tabIndex - 1]!), onSelect: () => setActiveTab(TABS[tabIndex - 1]!) } : undefined} next={tabIndex < TABS.length - 1 ? { label: label(TABS[tabIndex + 1]!), onSelect: () => setActiveTab(TABS[tabIndex + 1]!) } : undefined} /><div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-4)', padding: '2px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
      <div role="tablist" aria-label="Filas de revisão">{TABS.map((tab, position) => { const count = tab === 'inbox' ? items.length : tab === 'radar' ? radar.length : tab === 'insights' ? insights.length : suggestions.length; return <button key={tab} role="tab" aria-selected={activeTab === tab} aria-controls={`review-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); setActiveTab(TABS[(position + 1) % TABS.length] ?? 'inbox') } if (event.key === 'ArrowLeft') { event.preventDefault(); setActiveTab(TABS[(position - 1 + TABS.length) % TABS.length] ?? 'inbox') } }} style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: activeTab === tab ? 'var(--accent-primary)' : 'transparent', color: activeTab === tab ? 'white' : 'var(--text-secondary)', fontSize: '13px' }}>{label(tab)} ({count})</button> })}</div>
    </div></div>
    <p role="status" aria-live="polite" style={{ minHeight: '1.25rem' }}>{liveMessage}</p>
    {activeTab === 'inbox' && <p className="keyboard-help">Atalhos: J/K navegar · A aprovar · E editar · R rejeitar · B bloquear · S pular · . adiar</p>}

    {activeTab === 'radar' && <section id="review-panel-radar" role="tabpanel" aria-labelledby="radar" style={{ flex: 1, overflowY: 'auto' }}>{radar.length === 0 ? <EmptyState message="Nenhum achado do radar pendente." /> : <div style={{ display: 'grid', gap: '8px' }}>{radar.map((finding) => <article key={finding.id} className="card" style={{ padding: '12px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><strong>{finding.title}</strong>{finding.summary && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{finding.summary}</p>}</div><span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: finding.relevance_score >= 0.8 ? 'var(--status-error-subtle)' : 'var(--surface-overlay)' }}>{(finding.relevance_score * 100).toFixed(0)}%</span></div><div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>{[finding.concurso_alvo, finding.estado, finding.banca, finding.fase_ciclo?.replace(/_/g, ' ')].filter(Boolean).map((value) => <span key={value} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-overlay)' }}>{value}</span>)}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}><small style={{ color: 'var(--text-disabled)' }}>{finding.source_name ?? 'Fonte não informada'} · {new Date(finding.created_at).toLocaleString('pt-BR')}</small><div style={{ display: 'flex', gap: '4px' }}><button className="bridge-button" data-variant="primary" onClick={() => openSlotEditor(finding)}>Criar slot</button><button className="bridge-button" data-variant="quiet" onClick={() => { setSelectedFinding(finding); setDialogReason(''); setDialogError(''); setDialog('dismiss-radar') }}>Descartar</button></div></div></article>)}</div>}</section>}
    {activeTab === 'insights' && <section id="review-panel-insights" role="tabpanel" aria-labelledby="insights" style={{ flex: 1, overflowY: 'auto' }}>{insights.length === 0 ? <EmptyState message="Nenhum insight de concorrente pendente." /> : <div style={{ display: 'grid', gap: '8px' }}>{insights.map((insight) => <article key={insight.id} className="card" style={{ padding: '12px', borderLeft: insight.is_outlier ? '3px solid var(--status-warning)' : undefined }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{insight.title}</strong><span>@{insight.competitor_handle}</span></div>{insight.description && <p>{insight.description}</p>}{insight.hypothesis && <p><em>{insight.hypothesis}</em></p>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px' }}><button className="bridge-button" data-variant="primary" onClick={() => void postOrganicAction(`/api/admin/competitor-insights/${insight.id}/action`, { action: 'generate-suggestion' }, () => setInsights((rows) => rows.filter((row) => row.id !== insight.id)))}>Gerar sugestão</button><button className="bridge-button" data-variant="quiet" onClick={() => void postOrganicAction(`/api/admin/competitor-insights/${insight.id}/action`, { action: 'mark-seen' }, () => setInsights((rows) => rows.filter((row) => row.id !== insight.id)))}>Marcar visto</button></div></article>)}</div>}</section>}
    {activeTab === 'suggestions' && <section id="review-panel-suggestions" role="tabpanel" aria-labelledby="suggestions" style={{ flex: 1, overflowY: 'auto' }}>{suggestions.length === 0 ? <EmptyState message="Nenhuma sugestão de pauta pendente." /> : <div style={{ display: 'grid', gap: '8px' }}>{suggestions.map((suggestion) => <article key={suggestion.id} className="card" style={{ padding: '12px' }}><strong>{suggestion.title}</strong>{suggestion.description && <p>{suggestion.description}</p>}<div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>{[suggestion.suggested_format, suggestion.pillar, suggestion.source_type].filter(Boolean).map((value) => <span key={value} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-overlay)' }}>{value}</span>)}</div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px' }}><button className="bridge-button" data-variant="primary" onClick={() => void postOrganicAction(`/api/admin/content-suggestions/${suggestion.id}/action`, { action: 'approve' }, () => setSuggestions((rows) => rows.filter((row) => row.id !== suggestion.id)))}>Aprovar → calendário</button><button className="bridge-button" data-variant="secondary" onClick={() => openSuggestionDialog('edit-suggestion', suggestion)}>Editar e aprovar</button><button className="bridge-button" data-variant="quiet" onClick={() => openSuggestionDialog('reject-suggestion', suggestion)}>Rejeitar</button></div></article>)}</div>}</section>}

    {activeTab === 'inbox' && (!current ? <div id="review-panel-inbox" role="tabpanel" aria-labelledby="inbox"><EmptyState message={`Nada para revisar agora · ${decidedToday} decisões hoje`} /></div> : <div id="review-panel-inbox" role="tabpanel" aria-labelledby="inbox" style={{ flex: 1, minHeight: 0 }}><ThreePaneLayout list={<><h2>Fila ({items.length})</h2>{items.map((item, itemIndex) => <button className="review-list-item" aria-current={itemIndex === index ? 'true' : undefined} key={item.id} onClick={() => { setIndex(itemIndex); setEditing(false); setNotes('') }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>{label(item.item_type)}</strong>{item.risk_level && <PriorityChip priority={item.risk_level} />}</div><small>{item.reason}</small><time>{new Date(item.created_at).toLocaleString('pt-BR')}</time></button>)}</>} detail={<div style={{ padding: 'var(--space-4)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><p className="eyebrow">{label(current.item_type)}</p>{current.risk_level && <PriorityChip priority={current.risk_level} />}</div><h2 style={{ marginBottom: 'var(--space-6)' }}>{current.reason ?? 'Revisão necessária'}</h2>{editing ? <TextareaField label="Texto revisado" value={editedText} onChange={(event) => setEditedText(event.target.value)} rows={8} /> : current.previous_state ? <DiffViewer before={current.previous_state} after={current.suggested_action} /> : <ReadableRecord value={current.suggested_action} />}<TextareaField label="Observação da decisão" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} description="Opcional; use para registrar contexto da decisão." /><div className="review-actions" style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>{editing ? <><button className="bridge-button" data-variant="primary" disabled={busy || !editedText.trim()} onClick={() => void decide('edit')}>{busy ? 'Salvando…' : 'Salvar edição'}</button><button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button></> : <><button className="bridge-button" data-variant="primary" disabled={busy} onClick={() => void decide('approve')}>[A] Aprovar</button><button className="bridge-button" data-variant="secondary" disabled={busy} onClick={() => void decide('edit')}>[E] Editar</button><button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => void decide('reject')}>[R] Rejeitar</button><button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => void decide('block')} style={{ color: 'var(--status-error)' }}>[B] Bloquear</button><button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => void decide('skip')}>[S] Pular</button></>}</div></div>} context={<div style={{ padding: 'var(--space-4)' }}><h2>Contexto adicional</h2><ReadableRecord value={current.context} /><h3 style={{ marginTop: 'var(--space-6)' }}>Auditoria</h3><p>A decisão registra o operador, o estado anterior, o estado final e o horário no log imutável de governança.</p></div>} /></div>)}

    <Dialog open={dialog !== null} busy={dialogBusy} onOpenChange={(open) => { if (!open && !dialogBusy) setDialog(null) }} title={dialog === 'slot' ? 'Criar slot editorial' : dialog === 'dismiss-radar' ? 'Descartar achado do radar' : dialog === 'edit-suggestion' ? 'Editar e aprovar sugestão' : 'Rejeitar sugestão'}>
      <form onSubmit={submitDialog} style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {dialog === 'slot' && <><InputField label="Título" value={slotTitle} onChange={(event) => setSlotTitle(event.target.value)} maxLength={180} autoFocus /><TextareaField label="Conteúdo" value={slotCaption} onChange={(event) => setSlotCaption(event.target.value)} rows={6} maxLength={4000} /><label className="editor-field">Canal<select value={slotChannel} onChange={(event) => setSlotChannel(event.target.value as 'instagram' | 'threads')}><option value="instagram">Instagram</option><option value="threads">Threads</option></select></label><InputField label="Horário sugerido" type="datetime-local" value={slotScheduledFor} onChange={(event) => setSlotScheduledFor(event.target.value)} /></>}
        {dialog === 'edit-suggestion' && <><fieldset style={{ display: 'grid', gap: 'var(--space-3)', border: 0, padding: 0, margin: 0 }}><legend>Ideia</legend><InputField label="Título" value={suggestionTitle} onChange={(event) => setSuggestionTitle(event.target.value)} maxLength={180} autoFocus /><TextareaField label="Descrição" value={suggestionDescription} onChange={(event) => setSuggestionDescription(event.target.value)} rows={4} maxLength={10000} /></fieldset><fieldset style={{ display: 'grid', gap: 'var(--space-3)', border: 0, padding: 0, margin: 0 }}><legend>Criativo promovido</legend><TextareaField label="Legenda / conteúdo" value={suggestionCaption} onChange={(event) => setSuggestionCaption(event.target.value)} rows={6} maxLength={4000} /><InputField label="Hashtags" description="Separe por vírgula ou quebra de linha; o # é opcional." value={suggestionHashtags} onChange={(event) => setSuggestionHashtags(event.target.value)} maxLength={2000} /><InputField label="CTA" value={suggestionCta} onChange={(event) => setSuggestionCta(event.target.value)} maxLength={500} /></fieldset><fieldset style={{ display: 'grid', gap: 'var(--space-3)', border: 0, padding: 0, margin: 0 }}><legend>Copy do formato</legend><ContentCopyFields format={suggestionFormat} value={suggestionCopy} onChange={setSuggestionCopy} /></fieldset><fieldset style={{ display: 'grid', gap: 'var(--space-3)', border: 0, padding: 0, margin: 0 }}><legend>Distribuição</legend><label className="editor-field">Formato<select value={suggestionFormat} onChange={(event) => setSuggestionFormat(event.target.value)}><option value="reels">Reels</option><option value="carrossel">Carrossel</option><option value="estatico">Estático / post</option><option value="stories">Stories</option></select></label><label className="editor-field">Canal<select value={suggestionChannel} onChange={(event) => setSuggestionChannel(event.target.value as 'instagram' | 'threads')}><option value="instagram">Instagram</option><option value="threads">Threads</option></select></label><InputField label="Agendar para (opcional)" type="datetime-local" value={suggestionScheduledFor} onChange={(event) => setSuggestionScheduledFor(event.target.value)} /><small>Fuso operacional: America/Sao_Paulo. Sem horário, o criativo fica planejado para revisão no calendário.</small></fieldset><details><summary>Ver evidências da sugestão</summary><ReadableRecord value={selectedSuggestion?.evidence ?? {}} /></details></>}
        {(dialog === 'dismiss-radar' || dialog === 'reject-suggestion') && <TextareaField label="Motivo (opcional)" description="O motivo ajuda a calibrar a curadoria." value={dialogReason} onChange={(event) => setDialogReason(event.target.value)} rows={4} maxLength={1000} autoFocus />}
        {dialogError && <p role="alert" style={{ color: 'var(--status-error)' }}>{dialogError}</p>}
        <div className="action-row"><button type="button" className="bridge-button" data-variant="quiet" disabled={dialogBusy} onClick={() => setDialog(null)}>Cancelar</button><button type="submit" className="bridge-button" data-variant={dialog === 'dismiss-radar' || dialog === 'reject-suggestion' ? 'quiet' : 'primary'} disabled={dialogBusy}>{dialogBusy ? 'Salvando…' : dialog === 'dismiss-radar' ? 'Descartar' : dialog === 'reject-suggestion' ? 'Rejeitar' : 'Confirmar'}</button></div>
      </form>
    </Dialog>
  </div>
}

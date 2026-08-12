'use client'

import { EmptyState, KpiCard, KpiRow, PageHeader, ThreePaneLayout, PriorityChip } from '@plataforma/ui-bridge'
import { toast } from '@plataforma/ui-bridge'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { appPath } from '@/lib/base-path'

interface ReviewItem { 
  id: string;
  item_type: string;
  reason: string | null;
  suggested_action: Record<string, unknown>;
  context: Record<string, unknown>;
  created_at: string;
  risk_level?: 'P0' | 'P1' | 'P2' | 'P3';
  previous_state?: Record<string, unknown>;
}

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase())
}

function ReadableRecord({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  return entries.length ? (
    <dl className="record-list">
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt>{label(key)}</dt>
          <dd>
            {item && typeof item === 'object' 
              ? Object.entries(item as Record<string, unknown>).map(([nested, nestedValue]) => `${label(nested)}: ${String(nestedValue)}`).join(' · ')
              : String(item ?? '—')}
          </dd>
        </div>
      ))}
    </dl>
  ) : <p>Nenhuma informação adicional.</p>
}

function DiffViewer({ before, after }: { before: Record<string, unknown>, after: Record<string, unknown> }) {
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
  
  return (
    <div className="diff-viewer">
      {allKeys.map(key => {
        const b = before[key]
        const a = after[key]
        if (b === a) return null
        
        return (
          <div key={key} className="diff-row" style={{ marginBottom: 'var(--space-4)' }}>
            <strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>{label(key)}</strong>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--status-error-subtle)', borderLeft: '2px solid var(--status-error)' }}>
                <del style={{ color: 'var(--status-error-strong)', textDecoration: 'none' }}>{String(b ?? '(vazio)')}</del>
              </div>
              <div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--status-success-subtle)', borderLeft: '2px solid var(--status-success)' }}>
                <ins style={{ color: 'var(--status-success-strong)', textDecoration: 'none' }}>{String(a ?? '(vazio)')}</ins>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ReviewInboxClient({ initialItems, decidedToday }: { initialItems: ReviewItem[]; decidedToday: number }) {
  const [items, setItems] = useState(() => {
    // Sort items by risk level (P0 > P1 > P2 > P3 > undefined)
    const order = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3, 'undefined': 4 }
    return [...initialItems].sort((a, b) => (order[a.risk_level ?? 'undefined'] ?? 4) - (order[b.risk_level ?? 'undefined'] ?? 4))
  })
  
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [notes, setNotes] = useState('')
  
  const current = items[index]
  
  const decide = useCallback(async (action: 'approve' | 'edit' | 'reject' | 'block' | 'snooze' | 'skip') => {
    if (!current || busy) return;
    
    if (action === 'skip') {
      setIndex(i => Math.min(items.length - 1, i + 1))
      toast('Item pulado (Skip)')
      return
    }
    
    if (action === 'edit' && !editing) {
      setEditedText(String(current.suggested_action.text ?? ''))
      setEditing(true)
      return
    }
    
    setBusy(true)
    try {
      const payload: Record<string, unknown> = { notes: notes || undefined };
      if (action === 'snooze') payload.snoozeUntil = new Date(Date.now() + 86_400_000).toISOString()
      if (action === 'edit') payload.suggestedAction = { ...current.suggested_action, text: editedText }
      
      const response = await fetch(appPath(`/api/review-inbox/${current.id}/${action}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const body = await response.json() as { item?: ReviewItem; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível registrar a decisão')
      
      if (action === 'edit' && body.item) {
        setItems(value => value.map(item => item.id === current.id ? body.item! : item))
        setEditing(false)
        toast.success('Sugestão atualizada com sucesso.')
      } else {
        setItems(value => value.filter(item => item.id !== current.id))
        setIndex(0) // Reset to first item since the list shrank
        toast.success(`Ação '${action}' registrada.`, {
          action: {
            label: 'Desfazer',
            onClick: () => console.log('Undo via API not implemented yet')
          }
        })
      }
      setNotes('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setBusy(false)
    }
  }, [current, busy, editing, editedText, notes, items.length])
  
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,textarea')) return;
      const key = event.key.toLowerCase();
      
      if (key === 'a') void decide('approve');
      else if (key === 'e') void decide('edit');
      else if (key === 'r') void decide('reject');
      else if (key === 'b') void decide('block');
      else if (key === 's') void decide('skip');
      else if (key === '.') void decide('snooze');
      else if (key === 'j') setIndex(value => Math.min(items.length - 1, value + 1));
      else if (key === 'k') setIndex(value => Math.max(0, value - 1));
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler)
  }, [decide, items.length])
  
  return (
    <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Review Inbox" subtitle="Triagem humana com contexto legível e trilha de auditoria" />
      <KpiRow>
        <KpiCard label="Pendentes" value={items.length} />
        <KpiCard label="Decididos hoje" value={decidedToday} />
      </KpiRow>
      <p className="keyboard-help">Atalhos: J/K navegar · A aprovar · E editar · R rejeitar · B bloquear · S pular · . adiar</p>
      
      {!current ? (
        <EmptyState message={`Nada para revisar agora · ${decidedToday} decisões hoje`} />
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ThreePaneLayout 
            list={
              <>
                <h2>Fila ({items.length})</h2>
                {items.map((item, itemIndex) => (
                  <button 
                    className="review-list-item" 
                    aria-current={itemIndex === index ? 'true' : undefined} 
                    key={item.id} 
                    onClick={() => { setIndex(itemIndex); setEditing(false); setNotes(''); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{label(item.item_type)}</strong>
                      {item.risk_level && <PriorityChip priority={item.risk_level} />}
                    </div>
                    <small>{item.reason}</small>
                    <time>{new Date(item.created_at).toLocaleString('pt-BR')}</time>
                  </button>
                ))}
              </>
            } 
            detail={
              <div style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p className="eyebrow">{label(current.item_type)}</p>
                  {current.risk_level && <PriorityChip priority={current.risk_level} />}
                </div>
                <h2 style={{ marginBottom: 'var(--space-6)' }}>{current.reason ?? 'Revisão necessária'}</h2>
                
                {editing ? (
                  <label className="editor-field">Texto revisado
                    <textarea value={editedText} onChange={(event) => setEditedText(event.target.value)} rows={8} />
                  </label>
                ) : current.previous_state ? (
                  <DiffViewer before={current.previous_state} after={current.suggested_action} />
                ) : (
                  <ReadableRecord value={current.suggested_action} />
                )}
                
                <label className="editor-field" style={{ marginTop: 'var(--space-6)' }}>
                  Observação da decisão
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Motivo para bloqueio/rejeição (opcional)" />
                </label>
                
                <div className="review-actions" style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {editing ? (
                    <>
                      <button className="bridge-button" data-variant="primary" disabled={busy || !editedText.trim()} onClick={() => void decide('edit')}>
                        {busy ? 'Salvando…' : 'Salvar edição'}
                      </button>
                      <button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="bridge-button" data-variant="primary" disabled={busy} onClick={() => void decide('approve')}>[A] Aprovar</button>
                      <button className="bridge-button" data-variant="secondary" disabled={busy} onClick={() => void decide('edit')}>[E] Editar</button>
                      <button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => void decide('reject')}>[R] Rejeitar</button>
                      <button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => void decide('block')} style={{ color: 'var(--status-error)' }}>[B] Bloquear</button>
                      <button className="bridge-button" data-variant="quiet" disabled={busy} onClick={() => void decide('skip')}>[S] Pular</button>
                    </>
                  )}
                </div>
              </div>
            } 
            context={
              <div style={{ padding: 'var(--space-4)' }}>
                <h2>Contexto Adicional</h2>
                <ReadableRecord value={current.context} />
                
                <h3 style={{ marginTop: 'var(--space-6)' }}>Auditoria</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>A decisão registra o operador logado, estado anterior, estado final e horário no log imutável de governança (Event Sourcing).</p>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}

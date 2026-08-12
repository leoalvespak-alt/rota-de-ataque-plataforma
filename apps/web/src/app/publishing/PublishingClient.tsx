'use client'

import { ChannelBadge, EmptyState, KanbanBoard, KpiCard, KpiRow, PageHeader, StatusBadge } from '@plataforma/ui-bridge'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from '@plataforma/ui-bridge'

export function PublishingClient({ publications, scheduled, published, failed }: { publications: any[], scheduled: number, published: number, failed: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'kanban'
  const [isPending, startTransition] = useTransition()

  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })

  const statuses = ['draft', 'ready', 'approved', 'scheduled', 'publishing', 'published', 'failed']

  function changeMode(nextMode: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextMode !== 'kanban') params.set('mode', nextMode)
    else params.delete('mode')
    
    startTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
    })
  }

  function simulateGateCheck() {
    toast('IntegrationGate: Analisando fila...', {
      action: {
        label: 'Ver conflito',
        onClick: () => toast.error('Conflito detectado: 2 posts na mesma janela do Instagram.')
      }
    })
  }

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader title="Publicação multicanal" subtitle="Calendário editorial, fila de aprovação e comprovantes por canal" />
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="bridge-button" data-variant="secondary" onClick={simulateGateCheck}>
            Verificar Conflitos (IntegrationGate)
          </button>
          <div style={{ display: 'flex', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button 
              onClick={() => changeMode('kanban')}
              style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: mode === 'kanban' ? 'var(--accent-primary)' : 'transparent', color: mode === 'kanban' ? 'white' : 'var(--text-secondary)' }}
            >
              Kanban
            </button>
            <button 
              onClick={() => changeMode('calendar')}
              style={{ padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: mode === 'calendar' ? 'var(--accent-primary)' : 'transparent', color: mode === 'calendar' ? 'white' : 'var(--text-secondary)' }}
            >
              Calendário
            </button>
          </div>
        </div>
      </div>
      
      <KpiRow>
        <KpiCard label="Agendadas" value={scheduled} />
        <KpiCard label="Publicadas" value={published} />
        <KpiCard label="Falhas" value={failed} />
        <KpiCard label="Canais" value={new Set(publications.map(item => item.channel)).size} />
      </KpiRow>
      
      <div style={{ flex: 1, overflowY: 'auto', marginTop: 'var(--space-4)' }}>
        {publications.length ? (
          mode === 'calendar' ? (
            <section className="card" aria-label="Calendário mensal">
              <h2>{now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
              <div className="calendar-grid">
                {days.map(day => (
                  <article className="calendar-day" key={day.toISOString()}>
                    <strong>{day.getDate()}</strong>
                    {publications
                      .filter(item => item.scheduled_for && new Date(item.scheduled_for).toDateString() === day.toDateString())
                      .slice(0, 3)
                      .map(item => (
                        <small key={item.id} style={{ display: 'block', marginBottom: '2px', padding: '2px', background: 'var(--surface-overlay)' }}>
                          <ChannelBadge channel={item.channel} /> {item.title}
                        </small>
                      ))}
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <KanbanBoard columns={statuses.map(status => ({
              title: status,
              items: publications.filter(item => item.status === status).map(item => (
                <article className="card" key={`${status}:${item.id}`}>
                  <header>
                    <ChannelBadge channel={item.channel} />
                    <StatusBadge status={item.status} />
                  </header>
                  <strong>{item.title}</strong>
                  <p>{item.scheduled_for ? new Date(item.scheduled_for).toLocaleString('pt-BR') : 'Sem horário'}</p>
                  {item.external_id && <small>Comprovante externo: {item.external_id}</small>}
                </article>
              ))
            }))} />
          )
        ) : (
          <EmptyState message="Nenhuma publicação foi criada nesta campanha. Aprove um conteúdo e gere uma variante para iniciar." />
        )}
      </div>
    </main>
  )
}

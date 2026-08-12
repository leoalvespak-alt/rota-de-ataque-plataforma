// @ts-nocheck
"use client"
import { useEffect, useRef, useState, useMemo } from 'react'
import { EmptyState, PageHeader, StatusBadge, DataGrid } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import { createColumnHelper } from '@tanstack/react-table'
import { toast } from '@plataforma/ui-bridge'

type Job = { id: string, title: string, role: string, status: string, priority: string, created_at: string }

const columnHelper = createColumnHelper<Job>()

export default function CreativeBridge() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [status, setStatus] = useState('Carregando oportunidade…')
  const editor = useRef<Window | null>(null)

  // Mock jobs for DataGrid
  const mockJobs: Job[] = useMemo(() => [
    { id: '1', title: 'Carrossel Dores do Público', role: 'Designer', status: 'pending', priority: 'P0', created_at: new Date().toISOString() },
    { id: '2', title: 'Copy E-mail Lançamento', role: 'Copywriter', status: 'in_progress', priority: 'P1', created_at: new Date().toISOString() }
  ], [])

  const columns = useMemo(() => [
    columnHelper.accessor('title', {
      header: 'Tarefa Criativa',
      cell: info => <strong>{info.getValue()}</strong>
    }),
    columnHelper.accessor('role', {
      header: 'Responsável',
      cell: info => <span>{info.getValue()}</span>
    }),
    columnHelper.accessor('priority', {
      header: 'Prioridade',
      cell: info => <StatusBadge status={info.getValue()} />
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => <StatusBadge status={info.getValue()} />
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ações',
      cell: () => <button className="bridge-button" data-variant="quiet" onClick={() => toast.success('Atribuído a você!')}>Assumir Job</button>
    })
  ], [])

  useEffect(() => {
    const opportunity = new URLSearchParams(location.search).get('opportunity')
    if (opportunity) {
      fetch(appPath(`/api/content-opportunities/${opportunity}/creative`)).then(async response => {
        const body = await response.json() as { payload?: Record<string, unknown>; error?: string }
        if (!response.ok || !body.payload) throw new Error(body.error ?? 'Oportunidade indisponível')
        setPayload(body.payload)
        setStatus('Criativo preparado para o editor')
      }).catch(error => setStatus(error instanceof Error ? error.message : 'Erro ao carregar'))
      window.opener?.postMessage({ type: 'creative-bridge-ready' }, location.origin)
    }
  }, [])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.data?.type === 'content-opportunity' && event.data.payload && typeof event.data.payload === 'object') {
        setPayload(event.data.payload as Record<string, unknown>)
        setStatus('Criativo preparado para o editor')
      }
      if (event.data?.type === 'design-system-ready' && payload) {
        (event.source as Window | null)?.postMessage({ type: 'editor-prefill', payload }, { targetOrigin: location.origin })
        setStatus('Conteúdo entregue ao editor')
      }
      if (event.data?.type === 'editor-prefill-received') setStatus('Editor carregou o conteúdo')
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [payload])

  function openEditor() {
    if (!payload) return
    editor.current = window.open('/design-system', 'design-system')
    setStatus(editor.current ? 'Abrindo editor…' : 'O navegador bloqueou a nova janela. Libere pop-ups e tente novamente.')
  }

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader title="Ponte criativa" subtitle="Transferência segura da oportunidade para o editor visual e fila de jobs" />
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
        
        <section>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Fila de Jobs (Design & Copy)</h2>
          <div style={{ height: '300px' }}>
            <DataGrid columns={columns} data={mockJobs} enableSorting={true} enableSelection={false} />
          </div>
        </section>

        <section className="card creative-preview">
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Editor de Sessão</h2>
          <StatusBadge status={status} />
          {payload ? (
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p className="eyebrow">{String(payload.eyebrow ?? 'Oportunidade')}</p>
              <h2>{String(payload.title ?? 'Sem título')}</h2>
              <p>{String(payload.body ?? 'Sem texto principal')}</p>
              <details style={{ marginTop: 'var(--space-2)' }}>
                <summary>Legenda e evidências</summary>
                <p style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--surface-overlay)' }}>{String(payload.caption ?? 'Nenhuma evidência')}</p>
              </details>
              <button className="bridge-button" data-variant="primary" onClick={openEditor} style={{ alignSelf: 'flex-start', marginTop: 'var(--space-4)' }}>Abrir no editor visual</button>
            </div>
          ) : (
            <EmptyState message={status} />
          )}
        </section>
      </div>
    </main>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createColumnHelper, gridFeatures } from '@plataforma/ui-bridge'
import { DataGrid, EmptyState, PageHeader, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

type Payload = Record<string, unknown> & { correlation_id?: string; thesis?: string; hook?: string; copy?: string }
type Delivery = { id: string; content_item_id: string; variant_id: string; status: string; schema_version: string; correlation_id: string; payload: Payload; created_at: string }
const column = createColumnHelper<typeof gridFeatures, Delivery>()

export default function CreativeBridge() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [payload, setPayload] = useState<Payload | null>(null)
  const [deliveryId, setDeliveryId] = useState<string | null>(null)
  const [status, setStatus] = useState('Selecione uma entrega ou abra uma oportunidade aprovada.')
  const editor = useRef<Window | null>(null)

  const loadDeliveries = useCallback(async () => {
    const response = await fetch(appPath('/api/creative-bridge'))
    const raw = await response.text()
    const body = raw && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(raw) as { deliveries?: Delivery[]; error?: string } : {}
    if (!response.ok) throw new Error(body.error ?? 'Falha ao carregar entregas')
    setDeliveries(body.deliveries ?? [])
  }, [])

  useEffect(() => {
    const opportunity = new URLSearchParams(location.search).get('opportunity')
    const task = opportunity
      ? fetch(appPath(`/api/content-opportunities/${opportunity}/creative`), { method: 'POST' }).then(async (response) => {
          const body = await response.json() as { payload?: Payload; delivery?: Delivery; error?: string }
          if (!response.ok || !body.payload) throw new Error(body.error ?? 'Oportunidade indisponível')
          setPayload(body.payload); setDeliveryId(body.delivery?.id ?? null); setStatus('Entrega criada e pronta para o editor')
        })
      : Promise.resolve()
    void task.then(loadDeliveries).catch((error) => setStatus(error instanceof Error ? error.message : 'Erro ao carregar'))
    window.opener?.postMessage({ type: 'creative-bridge-ready' }, location.origin)
  }, [loadDeliveries])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.data?.type === 'design-system-ready' && payload) {
        ;(event.source as Window | null)?.postMessage({ type: 'editor-prefill', payload }, { targetOrigin: location.origin })
        setStatus('Conteúdo entregue ao editor')
      }
      if (event.data?.type === 'editor-prefill-received') {
        setStatus('Editor carregou o conteúdo')
        if (deliveryId) void fetch(appPath(`/api/creative-bridge/${deliveryId}`), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'accepted' }) }).then(loadDeliveries)
      }
      if (event.data?.type === 'editor-return' && deliveryId) {
        const result = event.data.result as { storageRef?: string; filename?: string; mimeType?: string; width?: number; height?: number; checksum?: string; copy?: string; editorProjectId?: string } | undefined
        if (!result?.storageRef) { setStatus('O editor devolveu um resultado sem asset exportado.'); return }
        void fetch(appPath(`/api/creative-bridge/${deliveryId}/return`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(result) })
          .then(async response => ({ response, body: await response.json().catch(() => ({})) }))
          .then(({ response, body }) => { if (!response.ok) throw new Error(body.error ?? 'Não foi possível persistir o retorno'); setStatus('Asset e copy retornaram para revisão humana.'); return loadDeliveries() })
          .catch(error => setStatus(error instanceof Error ? error.message : 'Falha ao receber o retorno.'))
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [deliveryId, loadDeliveries, payload])

  const columns = useMemo(() => [
    column.accessor((row) => String(row.payload.thesis ?? row.payload.hook ?? row.content_item_id), { id: 'title', header: 'Entrega', cell: (info) => <strong>{info.getValue()}</strong> }),
    column.accessor('schema_version', { header: 'Contrato' }),
    column.accessor('status', { header: 'Status', cell: (info) => <StatusBadge status={info.getValue()} /> }),
    column.accessor('created_at', { header: 'Criada em', cell: (info) => new Date(info.getValue()).toLocaleString('pt-BR') }),
    column.display({ id: 'actions', header: 'Ações', cell: ({ row }) => <button className="bridge-button" onClick={() => { setPayload(row.original.payload); setDeliveryId(row.original.id); setStatus('Entrega selecionada') }}>Selecionar</button> }),
  ], [])

  function openEditor() {
    if (!payload) return
    const editorUrl = process.env.NEXT_PUBLIC_DESIGN_SYSTEM_URL ?? window.location.origin
    editor.current = window.open(editorUrl, 'design-system')
    setStatus(editor.current ? 'Abrindo editor…' : 'O navegador bloqueou a nova janela.')
  }

  return <main className="page">
    <PageHeader title="Ponte criativa" subtitle="Entregas reais, versionadas e rastreáveis entre o Prospector e o editor visual" />
    <section style={{ marginTop: 'var(--space-4)' }}><h2>Entregas</h2>{deliveries.length ? <DataGrid columns={columns} data={deliveries} enableSorting enableSelection={false} /> : <EmptyState message="Nenhuma entrega criativa foi criada." />}</section>
    <section className="card creative-preview" style={{ marginTop: 'var(--space-6)' }}>
      <h2>Prévia da sessão</h2><StatusBadge status={status} />
      {payload ? <div style={{ marginTop: 'var(--space-4)' }}><p className="eyebrow">Contrato {String(payload.schema_version ?? 'desconhecido')}</p><h2>{String(payload.hook ?? payload.thesis ?? 'Sem título')}</h2><p>{String(payload.copy ?? '')}</p><small>Correlação: {String(payload.correlation_id ?? 'não informada')}</small><div className="action-row"><button className="bridge-button" data-variant="primary" onClick={openEditor}>Abrir no editor visual</button></div><p>O retorno só é concluído pelo editor quando um asset exportado e seus metadados forem enviados de volta.</p></div> : <EmptyState message={status} />}
    </section>
  </main>
}

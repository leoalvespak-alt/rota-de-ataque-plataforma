'use client'

import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@plataforma/ui-bridge'

export default function CreativeBridge() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [status, setStatus] = useState('Aguardando oportunidade de conteúdo')
  const editor = useRef<Window | null>(null)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.data?.type === 'content-opportunity' && event.data.payload && typeof event.data.payload === 'object') {
        setPayload(event.data.payload as Record<string, unknown>)
        setStatus('Criativo preparado para o editor')
      }
      if (event.data?.type === 'design-system-ready' && payload) {
        if (event.source instanceof Window) event.source.postMessage({ type: 'editor-prefill', payload }, { targetOrigin: location.origin })
        setStatus('Payload entregue ao editor')
      }
      if (event.data?.type === 'editor-prefill-received') setStatus('Editor carregou o briefing')
    }
    window.addEventListener('message', receive)
    window.opener?.postMessage({ type: 'creative-bridge-ready' }, location.origin)
    return () => window.removeEventListener('message', receive)
  }, [payload])
  const openEditor = () => {
    if (!payload) return
    editor.current = window.open('/design-system', 'design-system')
    setStatus('Conectando ao editor…')
  }
  if (!payload) return <div className="page"><EmptyState message="Nada aqui ainda — selecione Gerar criativo no Content Opportunity" /></div>
  return <div className="page"><h1>Criativo preparado</h1><p role="status">{status}</p><button onClick={openEditor}>Abrir no editor</button><pre>{JSON.stringify(payload, null, 2)}</pre></div>
}

import { useEffect } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'

type CreativePayload = { thesis?: string; hook?: string; angle?: string; evidence?: Record<string, unknown> }

/** Recebe o handoff do dashboard sem serializar conteúdo sensível em query string. */
export function CreativeBridgeListener() {
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'editor-prefill') return
      const payload = event.data.payload as CreativePayload
      if (!payload || typeof payload !== 'object') return
      useEditorStore.getState().selectTemplate('sq-cover')
      useEditorStore.getState().replaceElements({
        eyebrow: payload.angle ?? 'OPORTUNIDADE',
        title: payload.hook ?? payload.thesis ?? 'Novo conteúdo',
        subtitle: payload.thesis ?? 'Criado a partir da inteligência de mercado.',
        redline: true,
      })
      sessionStorage.setItem('creative-bridge:last-payload', JSON.stringify(payload))
      if (event.source instanceof Window) event.source.postMessage({ type: 'editor-prefill-received' }, { targetOrigin: event.origin })
    }
    window.addEventListener('message', receive)
    window.opener?.postMessage({ type: 'design-system-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [])
  return null
}

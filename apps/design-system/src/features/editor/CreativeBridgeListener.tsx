import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useEditorStore } from '@/stores/useEditorStore'

const CreativePayload = z.object({
  schema_version: z.literal('1.0'), content_item_id: z.string().uuid(), variant_id: z.string().uuid(),
  opportunity_id: z.string().uuid().nullable(), campaign_id: z.string().uuid(), thesis: z.string().min(1), topic: z.string().min(1),
  hook: z.string().min(1), copy: z.string(), cta: z.string().nullable(), format: z.string(),
  slide_structure: z.array(z.record(z.string(), z.unknown())).max(20), media_requirements: z.record(z.string(), z.unknown()),
  template_recommendation: z.string().nullable(), source_references: z.array(z.object({ label: z.string(), url: z.string().url() })).max(20),
  correlation_id: z.string().uuid(),
}).strict()

/** Recebe somente o contrato Creative Bridge versionado, sem dados em query string. */
export function CreativeBridgeListener() {
  const [payload, setPayload] = useState<z.infer<typeof CreativePayload> | null>(null)
  const [storageRef, setStorageRef] = useState('')
  const [copy, setCopy] = useState('')
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'editor-prefill') return
      const parsed = CreativePayload.safeParse(event.data.payload)
      if (!parsed.success) return
      const payload = parsed.data
      useEditorStore.getState().selectTemplate(payload.template_recommendation ?? 'sq-cover')
      useEditorStore.getState().replaceElements({ eyebrow: payload.topic, title: payload.hook, subtitle: payload.thesis, redline: true })
      sessionStorage.setItem('creative-bridge:last-payload', JSON.stringify(payload))
      setPayload(payload)
      setCopy(payload.copy)
      if (event.source instanceof Window) event.source.postMessage({ type: 'editor-prefill-received', correlationId: payload.correlation_id }, { targetOrigin: event.origin })
    }
    window.addEventListener('message', receive)
    window.opener?.postMessage({ type: 'design-system-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [])
  if (!payload || !window.opener) return null
  return <aside className="creative-bridge-return" aria-label="Retorno para o Prospector">
    <strong>Retornar ao Prospector</strong>
    <label>Referência do asset exportado<input value={storageRef} onChange={(event) => setStorageRef(event.target.value)} placeholder="storage/arte.png" /></label>
    <label>Copy final<textarea value={copy} onChange={(event) => setCopy(event.target.value)} rows={3} /></label>
    <button type="button" disabled={!storageRef.trim()} onClick={() => window.opener?.postMessage({ type: 'editor-return', result: { storageRef: storageRef.trim(), copy, editorProjectId: payload.correlation_id } }, window.location.origin)}>Enviar asset e copy</button>
  </aside>
}

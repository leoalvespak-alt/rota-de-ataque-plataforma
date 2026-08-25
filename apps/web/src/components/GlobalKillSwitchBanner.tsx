'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { appPath } from '@/lib/base-path'

export function GlobalKillSwitchBanner() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const load = () => fetch(appPath('/api/kill-switch'), {
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => response.ok
      ? response.json() as Promise<{ enabled: boolean }>
      : null)
      .then((body) => setEnabled(Boolean(body?.enabled)))
      .catch(() => { if (!controller.signal.aborted) setEnabled(false) })
    void load()
    const interval = setInterval(load, 30_000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [])

  if (!enabled) return null
  return <aside role="status" className="bridge-inline-notice" style={{ margin: 0, borderRadius: 0 }}>
    <ShieldAlert size={16} aria-hidden />
    <strong>Kill-switch global ativo.</strong> Ações externas permanecem bloqueadas até a liberação pelo operador.
  </aside>
}

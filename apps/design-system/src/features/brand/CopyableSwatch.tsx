import { useState } from 'react'
import { toast } from 'sonner'

/** Espelha .color-swatch/copyColor() do Gerador/index.html original (linha 3492). */
export function CopyableSwatch({ hex, name, textColor }: { hex: string; name: string; textColor?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
    } catch {
      // Fallback silencioso — Clipboard API pode não estar disponível em contexto não-seguro.
    }
    setCopied(true)
    toast.success(`Copiado: ${hex}`)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-ui-border transition-transform hover:-translate-y-0.5"
      onClick={handleCopy}
    >
      <div className="flex h-20 items-end p-2" style={{ background: hex }}>
        <span
          className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: textColor ?? '#fff' }}
        >
          Copiar
        </span>
      </div>
      <div className="bg-ui-panel2 px-3 py-2.5">
        <div className="mb-0.5 text-xs font-semibold text-ui-text">{name}</div>
        <div className="font-mono text-xs tracking-wide text-ui-muted">{hex}</div>
      </div>
      {copied && (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/80 px-4 py-2 font-heading text-[13px] font-bold tracking-wide text-white uppercase">
          Copiado!
        </span>
      )}
    </div>
  )
}

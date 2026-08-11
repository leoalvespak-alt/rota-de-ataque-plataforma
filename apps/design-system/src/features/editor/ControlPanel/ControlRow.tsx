import type { ReactNode } from 'react'

interface ControlRowProps {
  label: string
  children: ReactNode
}

/** Espelha ctrlRow() do Gerador/index.html original (linha 2839). */
export function ControlRow({ label, children }: ControlRowProps) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-xs text-ui-muted">{label}</span>
      {children}
    </div>
  )
}

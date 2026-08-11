import type { ReactNode } from 'react'

interface ControlSectionProps {
  title: string
  children: ReactNode
}

/** Espelha ctrlSection() do Gerador/index.html original (linha 2836). */
export function ControlSection({ title, children }: ControlSectionProps) {
  return (
    <div className="border-b border-ui-border px-4 py-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase">
        {title}
      </div>
      {children}
    </div>
  )
}

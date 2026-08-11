import type { CSSProperties, ReactNode } from 'react'

interface TTagProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

/** Espelha .t-tag do Gerador/index.html (linha 451). Badge de categoria (ex: "DADO IMPORTANTE"). */
export function TTag({ children, style, className }: TTagProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        fontSize: 22,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        background: 'rgba(193,18,31,0.12)',
        color: 'var(--red)',
        border: '1px solid rgba(193,18,31,0.25)',
        padding: '5px 14px',
        borderRadius: 6,
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

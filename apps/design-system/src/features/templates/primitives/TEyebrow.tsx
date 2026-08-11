import type { CSSProperties, ReactNode } from 'react'

interface TEyebrowProps {
  children: ReactNode
  fontSize?: number
  style?: CSSProperties
  className?: string
}

/** Espelha .t-eyebrow do Gerador/index.html (linha 351). */
export function TEyebrow({ children, fontSize = 26, style, className }: TEyebrowProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        background: 'var(--red)',
        color: '#fff',
        padding: '8px 20px',
        borderRadius: 8,
        display: 'inline-block',
        fontSize,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'

interface TPageIndicatorProps {
  children: ReactNode
  fontSize?: number
  style?: CSSProperties
  className?: string
}

/** Espelha .t-page-indicator do Gerador/index.html (linha 431). Indicador "01 / 05" do carrossel. */
export function TPageIndicator({ children, fontSize = 26, style, className }: TPageIndicatorProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        background: 'var(--red)',
        color: '#fff',
        padding: '8px 18px',
        borderRadius: 8,
        fontSize,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

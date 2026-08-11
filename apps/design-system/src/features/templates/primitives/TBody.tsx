import type { CSSProperties, ReactNode } from 'react'

interface TBodyProps {
  children: ReactNode
  fontSize?: number
  dark?: boolean
  colorOverride?: string
  style?: CSSProperties
  className?: string
}

/**
 * Espelha .t-body do Gerador/index.html (linha 376).
 * Light: var(--light-muted) · Dark: var(--dark-muted) — regra `#card-canvas.dark .t-body` (linha 374).
 */
export function TBody({
  children,
  fontSize = 34,
  dark = false,
  colorOverride,
  style,
  className,
}: TBodyProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontWeight: 400,
        color: colorOverride ?? (dark ? 'var(--dark-muted)' : 'var(--light-muted)'),
        lineHeight: 1.55,
        fontSize,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

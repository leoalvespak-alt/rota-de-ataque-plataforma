import type { CSSProperties, ReactNode } from 'react'

interface TTitleProps {
  children: ReactNode
  fontSize?: number
  dark?: boolean
  /** Cor forçada (usada nos templates com imagem de fundo, ex: título branco sobre foto). */
  colorOverride?: string
  style?: CSSProperties
  className?: string
}

/**
 * Espelha .t-title do Gerador/index.html (linha 364).
 * Light: var(--light-text) · Dark: var(--dark-text) — regra `#card-canvas.dark .t-title` (linha 373).
 */
export function TTitle({
  children,
  fontSize = 80,
  dark = false,
  colorOverride,
  style,
  className,
}: TTitleProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: colorOverride ?? (dark ? 'var(--dark-text)' : 'var(--light-text)'),
        lineHeight: 1.05,
        fontSize,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

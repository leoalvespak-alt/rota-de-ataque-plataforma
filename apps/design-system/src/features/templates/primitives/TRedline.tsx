import type { CSSProperties } from 'react'

interface TRedlineProps {
  width?: number
  height?: number
  style?: CSSProperties
  className?: string
}

/** Espelha .t-redline do Gerador/index.html (linha 444). Divisor vermelho de marca. */
export function TRedline({ width = 60, height = 5, style, className }: TRedlineProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        background: 'var(--red)',
        borderRadius: 3,
        ...style,
      }}
    />
  )
}

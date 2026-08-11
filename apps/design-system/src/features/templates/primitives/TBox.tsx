import type { CSSProperties, ReactNode } from 'react'

interface TBoxProps {
  children: ReactNode
  dark?: boolean
  style?: CSSProperties
  className?: string
}

/**
 * Espelha .t-box do Gerador/index.html (linha 383).
 * Caixa de fundo semi-transparente atrás de texto, para legibilidade sobre imagem/textura.
 */
export function TBox({ children, dark = false, style, className }: TBoxProps) {
  return (
    <div
      className={className}
      style={{
        background: dark ? 'var(--dark-box)' : 'var(--light-box)',
        borderRadius: 10,
        padding: '14px 26px',
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'

interface TFooterProps {
  brand?: ReactNode
  dark?: boolean
  showSwipeHint?: boolean
  style?: CSSProperties
  className?: string
}

/**
 * Zona de rodapé comum do sistema editorial (skill copy-matrix.v1):
 * assinatura discreta + seta de deslizar. Sem número ou paginação de card.
 */
export function TFooter({
  brand = 'ROTA DE ATAQUE',
  dark = false,
  showSwipeHint = true,
  style,
  className,
}: TFooterProps) {
  return (
    <div
      data-testid="slot-footer"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '2px solid rgba(128,128,128,0.35)',
        padding: '20px 0 0',
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: dark ? '#e8e8e8' : '#1a1a1a',
        ...style,
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>{brand}</span>
      {showSwipeHint && (
        <svg data-testid="slot-swipe-hint" width="40" height="24" viewBox="0 0 40 24" aria-hidden="true">
          <path d="M4 12h28M24 5l8 7-8 7" fill="none" stroke="#C1121F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

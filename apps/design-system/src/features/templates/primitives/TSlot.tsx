import type { CSSProperties } from 'react'
import { ImageIcon } from 'lucide-react'

interface TSlotProps {
  slotId: string
  imageUrl?: string
  dark?: boolean
  onClick: (slotId: string) => void
  style?: CSSProperties
  className?: string
  label?: string
}

/**
 * Espelha .t-slot / .t-slot-label do Gerador/index.html (linhas 390-429).
 * Área clicável de upload de imagem. Quando há imageUrl, mostra a imagem (object-fit: cover);
 * caso contrário mostra o placeholder "IMAGEM" com ícone.
 */
export function TSlot({
  slotId,
  imageUrl,
  dark = false,
  onClick,
  style,
  className,
  label = 'IMAGEM',
}: TSlotProps) {
  return (
    <div
      className={className}
      data-slot={slotId}
      onClick={() => onClick(slotId)}
      style={{
        background: dark ? 'var(--dark-s2)' : 'var(--light-slot)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'opacity 0.2s',
        ...style,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      ) : (
        <div
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: dark ? 'var(--dark-muted)' : 'var(--light-muted)',
            opacity: 0.6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
            zIndex: 2,
            position: 'relative',
          }}
        >
          <ImageIcon size={32} strokeWidth={1.5} style={{ opacity: 0.5 }} />
          {label}
        </div>
      )}
    </div>
  )
}

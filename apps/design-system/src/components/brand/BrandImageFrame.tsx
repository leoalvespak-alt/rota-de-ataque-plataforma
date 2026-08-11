import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FrameVariant = 'default' | 'rounded' | 'circle' | 'card' | 'outline'

interface BrandImageFrameProps {
  variant?: FrameVariant
  dark?: boolean
  aspectRatio?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  src?: string
  alt?: string
}

const frameClasses: Record<FrameVariant, string> = {
  default: 'rounded-[var(--radius-sm)] overflow-hidden',
  rounded: 'rounded-[var(--radius-card)] overflow-hidden',
  circle: 'rounded-full overflow-hidden aspect-square',
  card: 'rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]',
  outline: 'rounded-[var(--radius-card)] overflow-hidden border-2',
}

export function BrandImageFrame({
  variant = 'default',
  dark,
  aspectRatio,
  className,
  style,
  children,
  src,
  alt,
}: BrandImageFrameProps) {
  const borderColor = dark ? 'var(--dark-border)' : 'var(--light-border)'
  const slotBg = dark ? 'var(--dark-s2)' : 'var(--light-slot)'

  return (
    <div
      className={cn(
        frameClasses[variant],
        variant === 'outline' && `border-[${borderColor}]`,
        className,
      )}
      style={{
        aspectRatio,
        backgroundColor: slotBg,
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        children
      )}
    </div>
  )
}

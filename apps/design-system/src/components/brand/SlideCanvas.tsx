import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SlideCanvasProps {
  dark?: boolean
  zoom?: number
  exportMode?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function SlideCanvas({
  dark,
  zoom = 1,
  exportMode,
  className,
  style,
  children,
}: SlideCanvasProps) {
  const width = 1920
  const height = 1080
  const bg = dark ? 'var(--dark-bg)' : 'var(--light-bg)'

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        width: exportMode ? width : width * zoom,
        height: exportMode ? height : height * zoom,
        background: bg,
        transformOrigin: 'top left',
        transform: exportMode ? undefined : `scale(${zoom})`,
        ...style,
      }}
      data-canvas="slide"
      data-dark={dark}
    >
      <div
        className="absolute inset-0"
        style={{ padding: 'var(--format-slide-padding, 80px)' }}
      >
        {children}
      </div>
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CreativeCanvasProps {
  width: number
  height: number
  dark?: boolean
  zoom?: number
  exportMode?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function CreativeCanvas({
  width,
  height,
  dark,
  zoom = 1,
  exportMode,
  className,
  style,
  children,
}: CreativeCanvasProps) {
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
      data-canvas
      data-format={`${width}x${height}`}
      data-dark={dark}
      data-export-mode={exportMode}
    >
      {children}
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DocumentCanvasProps {
  dark?: boolean
  zoom?: number
  pageNumber?: number
  exportMode?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function DocumentCanvas({
  dark,
  zoom = 1,
  pageNumber,
  exportMode,
  className,
  style,
  children,
}: DocumentCanvasProps) {
  const width = 794
  const height = 1123
  const bg = dark ? 'var(--dark-bg)' : '#FFFFFF'

  return (
    <div
      className={cn('relative', className)}
      style={{
        width: exportMode ? width : width * zoom,
        height: exportMode ? height : height * zoom,
        background: bg,
        transformOrigin: 'top left',
        transform: exportMode ? undefined : `scale(${zoom})`,
        boxShadow: exportMode ? undefined : 'var(--shadow-card)',
        ...style,
      }}
      data-canvas="document"
      data-page={pageNumber}
      data-dark={dark}
    >
      <div
        className="absolute inset-0 flex flex-col"
        style={{ padding: 'var(--format-document-padding, 60px)' }}
      >
        <div className="flex-1 overflow-hidden">{children}</div>
        {pageNumber != null && (
          <footer
            className="text-center font-numeral text-xs pt-4"
            style={{ color: dark ? 'var(--dark-muted)' : 'var(--light-muted)' }}
          >
            {pageNumber}
          </footer>
        )}
      </div>
    </div>
  )
}

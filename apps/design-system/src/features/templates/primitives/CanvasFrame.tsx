import type { CSSProperties, ReactNode } from 'react'
import type { CanvasFormat } from '../types'
import { getCanvasDimensions } from '../canvasDimensions'

interface CanvasFrameProps {
  format: CanvasFormat
  dark: boolean
  children: ReactNode
  style?: CSSProperties
  /**
   * Só o canvas "real" (editor + export) deve passar `id="card-canvas"` — as miniaturas
   * da galeria (TemplateThumb) NÃO devem, senão o DOM acumula dezenas de elementos com
   * o mesmo id e `document.getElementById('card-canvas')` vira ambíguo (bug descoberto
   * durante a Fase 13: o export/diff visual pegava a primeira miniatura da galeria em
   * vez do canvas editável, porque HTML permite múltiplos ids iguais sem erro nenhum).
   */
  id?: string
}

/** Canvas base comum ao editor, às miniaturas e à exportação. */
export function CanvasFrame({ format, dark, children, style, id }: CanvasFrameProps) {
  const { width, height } = getCanvasDimensions(format)

  return (
    <div
      id={id}
      style={{
        width,
        height,
        flexShrink: 0,
        position: 'relative',
        background: dark ? 'var(--dark-bg)' : 'var(--light-bg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

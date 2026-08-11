import type { CSSProperties, ReactNode } from 'react'
import type { CanvasFormat } from '../types'

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

const FORMAT_SIZE: Record<CanvasFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1920 },
}

/**
 * Espelha #card-canvas do Gerador/index.html (linhas 288-307).
 * Inclui a textura tática (.canvas-texture, linha 310) e a barra de acento (.canvas-accent, linha 328),
 * que TODO template renderiza via baseTexture() no HTML original — aqui viram parte fixa do frame,
 * então nenhum componente de template precisa se lembrar de incluí-las.
 */
export function CanvasFrame({ format, dark, children, style, id }: CanvasFrameProps) {
  const { width, height } = FORMAT_SIZE[format]

  return (
    <div
      id={id}
      style={{
        width,
        height,
        position: 'relative',
        background: dark ? 'var(--dark-bg)' : 'var(--light-bg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* .canvas-texture — grid tático sutil, opacity 6% (linha 310) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.06,
          backgroundImage: dark
            ? 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* .canvas-accent — barra vermelha de 8px no topo (linha 328) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          background: 'var(--red)',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}

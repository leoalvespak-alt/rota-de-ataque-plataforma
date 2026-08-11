import { useLayoutEffect, useRef, useState } from 'react'
import { CanvasFrame } from '@/features/templates/primitives'
import type { TemplateDefinition } from '@/features/templates/types'
import { CardLayoutProvider } from '@/features/editor/layout/cardLayout'

interface TemplateThumbProps {
  template: TemplateDefinition<never>
  elements?: Record<string, unknown>
  dark?: boolean
}

/**
 * 🆕 Resolve a dívida D1 da análise do projeto: no Gerador/index.html original,
 * `buildThumbHtml()` era um dicionário manual que cobria só 12 dos 26 templates —
 * os outros 14 caíam num fallback vazio (só a barra vermelha, sem nenhum preview real).
 *
 * Aqui a miniatura é sempre o próprio `Render` do template, renderizado em escala
 * reduzida via CSS transform (`pointer-events: none` para não ser editável na galeria) —
 * cobertura automática de 26/26, e nunca fica dessincronizada de como o template
 * realmente se parece (uma fonte de verdade, não uma segunda representação para manter).
 */
export function TemplateThumb({ template, elements, dark = false }: TemplateThumbProps) {
  const { Render, defaults, format } = template
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(260)
  const scale = width / 1080

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => {
      const nextWidth = container.getBoundingClientRect().width
      if (nextWidth > 0) setWidth(nextWidth)
    }

    updateWidth()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ width: '100%', aspectRatio: format === 'portrait' ? '9 / 16' : '1 / 1' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        <CanvasFrame format={format} dark={dark}>
          <CardLayoutProvider elements={(elements ?? defaults) as Record<string, unknown>}>
            <Render elements={(elements ?? defaults) as never} dark={dark} />
          </CardLayoutProvider>
        </CanvasFrame>
      </div>
    </div>
  )
}

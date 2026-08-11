import { useRef, type ReactNode } from 'react'
import { ExportNodeRefContext } from './ExportNodeRefContext'
import { ExportNode } from './ExportNode'

/**
 * Monta o ExportNode uma única vez na raiz do app e disponibiliza sua ref via Context —
 * assim qualquer lugar (header, série, histórico) pode disparar uma captura sem precisar
 * prop-drill a ref por toda a árvore.
 */
export function ExportNodeProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <ExportNodeRefContext.Provider value={ref}>
      {children}
      <ExportNode ref={ref} />
    </ExportNodeRefContext.Provider>
  )
}

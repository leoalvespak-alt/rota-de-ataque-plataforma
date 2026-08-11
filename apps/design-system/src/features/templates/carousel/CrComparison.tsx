import type { TemplateRenderProps } from '../types'
import { TTitle, TRedline, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { CrSlideControls } from './CrSlide'

export interface CrComparisonElements {
  title: string
  left: string[]
  right: string[]
  page: string
}

/**
 * Espelha renderCarouselComparison() do Gerador/index.html (linha 2600).
 * Corrige a auditoria items 1-2: as células usavam `data-field="l${i}"`/`"r${i}"`,
 * chaves soltas que nenhum lugar lia de volta. Aqui o path aponta para `left.${i}`/`right.${i}`.
 */
export function CrComparisonRender({
  elements: el,
  dark,
}: TemplateRenderProps<CrComparisonElements>) {
  const left = Array.isArray(el.left) ? el.left : ['Item negativo 1', 'Item negativo 2']
  const right = Array.isArray(el.right) ? el.right : ['Item positivo 1', 'Item positivo 2']

  return (
    <div className="relative z-2 flex h-full flex-col gap-6 p-20">
      <TTitle fontSize={76} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      {/* Nota de fidelidade: os cards esquerdo/direito são sempre light no original
          (renderCarouselComparison, linhas 2604-2605) — sem regra dark mode, replicado. */}
      <TRedline />
      <div className="flex flex-1 gap-5">
        <div className="flex-1 rounded-xl p-6" style={{ background: 'var(--light-bg-alt)' }}>
          <div className="mb-3 font-heading text-[22px] font-bold tracking-[0.08em] text-[#EF4444] uppercase">
            SEM MÉTODO
          </div>
          <div>
            {left.map((l, i) => (
              <div
                key={i}
                className="flex gap-2.5 py-2.5 text-2xl"
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  color: 'var(--light-muted)',
                  borderBottom: '1px solid var(--light-border)',
                }}
              >
                <span className="font-bold text-[#EF4444]">✕</span>
                <span>
                  <EditableText path={`left.${i}`} value={l} as="span" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div
          className="flex-1 rounded-xl border-2 p-6"
          style={{ background: 'var(--light-bg-alt)', borderColor: 'rgba(34,197,94,0.3)' }}
        >
          <div className="mb-3 font-heading text-[22px] font-bold tracking-[0.08em] text-[#22C55E] uppercase">
            ROTA DE ATAQUE
          </div>
          <div>
            {right.map((r, i) => (
              <div
                key={i}
                className="flex gap-2.5 py-2.5 text-2xl"
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  color: 'var(--light-text)',
                  borderBottom: '1px solid var(--light-border)',
                }}
              >
                <span className="font-bold text-[#22C55E]">✓</span>
                <span>
                  <EditableText path={`right.${i}`} value={r} as="span" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <TPageIndicator fontSize={26}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </div>
  )
}

/** Espelha buildCarouselSlideControls() do Gerador/index.html (linha 2811) — reusado por cr-comparison. */
export function CrComparisonControls(props: { elements: CrComparisonElements }) {
  return CrSlideControls(props)
}

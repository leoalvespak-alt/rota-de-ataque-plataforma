import type { TemplateRenderProps } from '../types'
import type { StatItem } from '../types'
import { TEyebrow, TTitle, TBody } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { SimpleControls } from '../shared/SimpleControls'

export interface SqStatsElements {
  eyebrow?: unknown
  title: string
  stats: StatItem[]
}

/**
 * Espelha renderStatsSquare() do Gerador/index.html (linha 2356).
 * Corrige a auditoria items 1-2 (o bug mais grave): no HTML original, `s.num`/`s.label`
 * eram contenteditable SEM `data-field` nenhum — a edição nunca era capturada e sumia
 * a cada re-render. Aqui cada célula tem `path` explícito (`stats.${i}.num`, etc).
 */
export function SqStatsRender({ elements: el, dark }: TemplateRenderProps<SqStatsElements>) {
  const stats = el.stats || [
    { num: '94%', label: 'taxa de aprovação' },
    { num: '38d', label: 'tempo médio' },
    { num: '10k', label: 'alunos' },
    { num: '24/7', label: 'suporte' },
  ]
  return (
    <div className="relative z-2 flex h-full flex-col gap-7 p-20">
      {el.eyebrow !== false && (
        <TEyebrow fontSize={22}>
          <EditableText path="eyebrow" value={el.eyebrow as string} />
        </TEyebrow>
      )}
      <TTitle fontSize={70} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      {/* Nota de fidelidade: o card de estatística é sempre var(--light-bg-alt) no
          original (renderStatsSquare, linha 2360) — sem regra de dark mode, replicado
          tal como é. Só o número (cor fixa var(--red)) e o label (.t-body) importam aqui. */}
      <div className="grid flex-1 grid-cols-2 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border p-7 px-5"
            style={{ background: 'var(--light-bg-alt)', borderColor: 'var(--light-border)' }}
          >
            <div
              className="font-mono text-[64px] leading-none font-bold"
              style={{ color: 'var(--red)' }}
            >
              <EditableText path={`stats.${i}.num`} value={s.num} />
            </div>
            <TBody fontSize={24} dark={false} style={{ textAlign: 'center' }}>
              <EditableText path={`stats.${i}.label`} value={s.label} />
            </TBody>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Espelha buildSimpleControls() do Gerador/index.html (linha 2628). */
export function SqStatsControls({ elements: el }: { elements: SqStatsElements }) {
  return <SimpleControls el={el} />
}

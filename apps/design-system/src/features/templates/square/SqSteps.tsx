import type { TemplateRenderProps, TemplateControlsProps, Hideable } from '../types'
import { TEyebrow, TTitle, TRedline, TBody } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { StepsControls } from '../shared/StepsControls'

export interface SqStepsElements {
  eyebrow: Hideable<string>
  title: string
  steps: string[]
}

/** Espelha renderStepsSquare() do Gerador/index.html (linha 2334). */
export function SqStepsRender({ elements: el, dark }: TemplateRenderProps<SqStepsElements>) {
  const steps = Array.isArray(el.steps) ? el.steps : ['Passo 1', 'Passo 2', 'Passo 3', 'Passo 4']
  return (
    <div className="relative z-2 flex h-full flex-col gap-6 p-20">
      {el.eyebrow !== false && (
        <TEyebrow fontSize={22}>
          <EditableText path="eyebrow" value={el.eyebrow} />
        </TEyebrow>
      )}
      <TTitle fontSize={68} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline />
      <div className="flex flex-1 flex-col justify-center gap-4">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-5">
            <div
              className="w-14 shrink-0 text-right font-mono text-[52px] leading-none font-bold"
              style={{ color: 'var(--red)' }}
            >
              0{i + 1}
            </div>
            <div className="flex-1 pt-2">
              <TBody fontSize={30} dark={dark}>
                <EditableText path={`steps.${i}`} value={s} />
              </TBody>
              {i < steps.length - 1 && (
                <div className="mt-3.5 h-px w-full" style={{ background: 'var(--light-border)' }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Espelha buildStepsControls() do Gerador/index.html (linha 2643). */
export function SqStepsControls({ elements: el }: TemplateControlsProps<SqStepsElements>) {
  return <StepsControls el={el} />
}

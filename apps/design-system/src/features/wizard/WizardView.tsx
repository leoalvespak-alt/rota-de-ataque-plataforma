import { useMemo } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { useUiStore } from '@/stores/useUiStore'
import { WizardStep1Format } from './steps/WizardStep1Format'
import { WizardStep2Template } from './steps/WizardStep2Template'
import { WizardStep3Content } from './steps/WizardStep3Content'
import { WizardStep4Script } from './steps/WizardStep4Script'
import { WizardStep5Canvas } from './steps/WizardStep5Canvas'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

const STEP_LABELS = ['Formato', 'Modelo', 'Conteúdo', 'Roteiro', 'Canvas']

export function WizardView() {
  const step = useWizardStore((s) => s.step)
  const active = useWizardStore((s) => s.active)
  const creativeType = useWizardStore((s) => s.creativeType)
  const aspectRatio = useWizardStore((s) => s.aspectRatio)
  const templateId = useWizardStore((s) => s.templateId)
  const freeText = useWizardStore((s) => s.freeText)
  const thesisId = useWizardStore((s) => s.thesisId)
  const cardCount = useWizardStore((s) => s.cardCount)
  const scriptCards = useWizardStore((s) => s.scriptCards)
  const nextStep = useWizardStore((s) => s.nextStep)
  const prevStep = useWizardStore((s) => s.prevStep)
  const exitWizard = useWizardStore((s) => s.exitWizard)
  const setTab = useUiStore((s) => s.setTab)

  const canAdvanceValue = useMemo(() => {
    switch (step) {
      case 1:
        if (!creativeType) return false
        if (creativeType !== 'story' && !aspectRatio) return false
        return true
      case 2:
        return !!templateId
      case 3:
        if (cardCount < 1 || cardCount > 10) return false
        return freeText.trim().length > 0 || !!thesisId
      case 4:
        return scriptCards.length > 0 && scriptCards.every((c) => c.title.trim().length > 0)
      case 5:
        return true
      default:
        return false
    }
  }, [step, creativeType, aspectRatio, templateId, freeText, thesisId, cardCount, scriptCards])

  if (!active) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ui-muted">
        Nenhum fluxo de criação ativo.{' '}
        <button
          onClick={() => setTab('dashboard')}
          className="ml-1 text-brand-red hover:underline"
        >
          Voltar ao início
        </button>
      </div>
    )
  }

  const handleFinish = () => {
    setTab('create')
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-ui-border bg-ui-panel px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isCurrent = stepNum === step
            const isCompleted = stepNum < step
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={cn(
                      'mx-2 h-px w-8 sm:w-12',
                      isCompleted ? 'bg-brand-red' : 'bg-ui-border',
                    )}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                      isCurrent && 'bg-brand-red text-white',
                      isCompleted && 'bg-brand-red/20 text-brand-red',
                      !isCurrent && !isCompleted && 'bg-ui-panel2 text-ui-muted',
                    )}
                  >
                    {isCompleted ? <Check className="size-3.5" /> : stepNum}
                  </div>
                  <span
                    className={cn(
                      'hidden text-xs font-medium sm:inline',
                      isCurrent ? 'text-ui-text' : 'text-ui-muted',
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 1 && <WizardStep1Format />}
        {step === 2 && <WizardStep2Template />}
        {step === 3 && <WizardStep3Content />}
        {step === 4 && <WizardStep4Script />}
        {step === 5 && <WizardStep5Canvas />}
      </div>

      <div className="shrink-0 border-t border-ui-border bg-ui-panel px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <button
            onClick={step === 1 ? () => { exitWizard(); setTab('dashboard') } : prevStep}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ui-border px-4 py-2 text-sm font-medium text-ui-text transition-colors hover:bg-ui-panel2"
          >
            <ChevronLeft className="size-4" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 5 ? (
            <button
              onClick={nextStep}
              disabled={!canAdvanceValue}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors',
                canAdvanceValue
                  ? 'bg-brand-red text-white hover:bg-brand-red-hover'
                  : 'cursor-not-allowed bg-ui-panel2 text-ui-muted',
              )}
            >
              Avançar
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-red-hover"
            >
              <Check className="size-4" />
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

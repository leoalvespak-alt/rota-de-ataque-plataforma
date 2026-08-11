import { ChevronDown, RotateCcw, ScanText } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useEditorStore } from '@/stores/useEditorStore'
import {
  DEFAULT_CARD_LAYOUT,
  getCardLayoutSettings,
  type CardSpacing,
} from '@/features/editor/layout/cardLayout'
import { cn } from '@/lib/utils'

const SPACING_OPTIONS: { value: CardSpacing; label: string }[] = [
  { value: 'compact', label: 'Compacto' },
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'comfortable', label: 'Arejado' },
]

export function ContentFitControls() {
  const elements = useEditorStore((state) => state.elements)
  const setElementField = useEditorStore((state) => state.setElementField)
  const settings = getCardLayoutSettings(elements)

  const update = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setElementField(['_layout', key], value)
  }

  return (
    <details className="group border-b border-ui-border" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase hover:bg-ui-panel2/50">
        <ScanText className="size-3.5 text-brand-red" />
        Ajuste do conteúdo
        <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-ui-text">Ajustar texto automaticamente</div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-ui-muted">
              Reduz textos longos conforme o espaço disponível deste card.
            </p>
          </div>
          <Switch
            aria-label="Ajustar texto automaticamente"
            checked={settings.autoFit}
            onCheckedChange={(checked) => update('autoFit', checked)}
            className="mt-0.5"
          />
        </div>

        <label className="block">
          <span className="mb-2 flex items-center justify-between text-[11px] text-ui-muted">
            Escala geral <strong className="font-medium text-ui-text">{settings.textScale}%</strong>
          </span>
          <Slider
            aria-label="Escala geral do texto"
            min={75}
            max={120}
            step={1}
            value={[settings.textScale]}
            onValueChange={([value]) => update('textScale', value ?? 100)}
            className="[&_[data-slot=slider-range]]:bg-brand-red [&_[data-slot=slider-track]]:bg-ui-border"
          />
        </label>

        <div>
          <div className="mb-2 text-[11px] text-ui-muted">Espaçamento entre linhas</div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-ui-panel2 p-1">
            {SPACING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={settings.spacing === option.value}
                onClick={() => update('spacing', option.value)}
                className={cn(
                  'rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors',
                  settings.spacing === option.value
                    ? 'bg-brand-red text-white'
                    : 'text-ui-muted hover:bg-ui-border hover:text-ui-text',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setElementField(['_layout'], { ...DEFAULT_CARD_LAYOUT })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ui-border px-2 py-2 text-[11px] text-ui-muted hover:border-brand-red hover:text-brand-red"
        >
          <RotateCcw className="size-3.5" /> Restaurar ajustes deste card
        </button>
      </div>
    </details>
  )
}

import { useMemo } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { TEMPLATES, getTemplateById } from '@/features/templates/registry'
import { CAROUSEL_PRESETS } from '@/features/templates/carouselPresets'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export function WizardStep2Template() {
  const templateId = useWizardStore((s) => s.templateId)
  const presetId = useWizardStore((s) => s.presetId)
  const setTemplateId = useWizardStore((s) => s.setTemplateId)
  const setPresetId = useWizardStore((s) => s.setPresetId)
  const getResolvedFilter = useWizardStore((s) => s.getResolvedFilter)

  const filter = getResolvedFilter()

  const availableTemplates = useMemo(
    () => TEMPLATES.filter((t) => t.filter === filter),
    [filter],
  )

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof availableTemplates> = {}
    for (const tpl of availableTemplates) {
      ;(groups[tpl.category] ??= []).push(tpl)
    }
    return groups
  }, [availableTemplates])

  if (filter === 'carousel') {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="mb-2 text-xl font-bold text-ui-text font-heading">Escolha o Modelo</h2>
        <p className="mb-8 text-sm text-ui-muted">
          Selecione uma combinação pronta de slides para o carrossel. Você poderá trocar o
          template de cada slide individualmente depois.
        </p>

        <div className="grid gap-4">
          {CAROUSEL_PRESETS.map((preset) => {
            const selected = presetId === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => setPresetId(preset.id)}
                className={cn(
                  'group relative rounded-xl border-2 p-4 text-left transition-all',
                  selected
                    ? 'border-brand-red bg-brand-red/5 shadow-sm'
                    : 'border-ui-border bg-ui-panel hover:border-brand-red/40',
                )}
              >
                <div className="flex items-center gap-2 pr-8">
                  <span className="text-sm font-semibold text-ui-text">{preset.name}</span>
                  <span className="rounded-full bg-ui-panel2 px-2 py-0.5 text-[10px] font-medium text-ui-muted">
                    {preset.slots.length} slides
                  </span>
                </div>
                <p className="mt-1 mb-4 text-xs text-ui-muted">{preset.description}</p>

                <div className="flex flex-wrap gap-2">
                  {preset.slots.map((slot, i) => {
                    const slotTpl = getTemplateById(slot.templateId)
                    return (
                      <div key={i} className="flex w-[108px] flex-col items-center gap-1">
                        <div
                          className="relative overflow-hidden rounded-md bg-ui-panel2"
                          style={{ width: 108, height: 108 }}
                        >
                          <div
                            className="pointer-events-none absolute left-0 top-0 origin-top-left"
                            style={{
                              width: 1080,
                              height: 1080,
                              transform: 'scale(0.1)',
                            }}
                          >
                            {slotTpl && (
                              <slotTpl.Render
                                elements={slotTpl.defaults as never}
                                dark={false}
                                exportMode={false}
                              />
                            )}
                          </div>
                        </div>
                        <span className="max-w-[108px] truncate text-[9px] text-ui-muted">
                          {slot.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {selected && (
                  <div className="absolute top-4 right-4 flex size-6 items-center justify-center rounded-full bg-brand-red text-white">
                    <Check className="size-3.5" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {CAROUSEL_PRESETS.length === 0 && (
          <p className="py-12 text-center text-sm text-ui-muted">
            Nenhum preset de carrossel disponível.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="mb-2 text-xl font-bold text-ui-text font-heading">Escolha o Modelo</h2>
      <p className="mb-8 text-sm text-ui-muted">
        Selecione um layout da biblioteca para usar como base.
      </p>

      {Object.entries(groupedByCategory).map(([category, templates]) => (
        <div key={category} className="mb-8">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ui-muted">
            {category}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {templates.map((tpl) => {
              const selected = templateId === tpl.id
              const Render = tpl.Render
              return (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={cn(
                    'group relative rounded-xl border-2 p-2 transition-all',
                    selected
                      ? 'border-brand-red bg-brand-red/5 shadow-sm'
                      : 'border-ui-border bg-ui-panel hover:border-brand-red/40',
                  )}
                >
                  <div
                    className="relative overflow-hidden rounded-lg bg-ui-panel2"
                    style={{
                      width: tpl.format === 'portrait' ? 1080 * 0.12 : 1080 * 0.18,
                      height: tpl.format === 'portrait' ? 1920 * 0.12 : 1080 * 0.18,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute left-0 top-0 origin-top-left"
                      style={{
                        width: 1080,
                        height: tpl.format === 'portrait' ? 1920 : 1080,
                        transform: `scale(${tpl.format === 'portrait' ? 0.12 : 0.18})`,
                      }}
                    >
                      <Render
                        elements={tpl.defaults as never}
                        dark={false}
                        exportMode={false}
                      />
                    </div>
                  </div>
                  <div className="mt-2 px-1">
                    <div className="truncate text-xs font-medium text-ui-text">{tpl.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tpl.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-ui-panel2 px-1.5 py-0.5 text-[9px] text-ui-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {selected && (
                    <div className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-brand-red text-white">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {availableTemplates.length === 0 && (
        <p className="py-12 text-center text-sm text-ui-muted">
          Nenhum modelo disponível para o formato selecionado.
        </p>
      )}
    </div>
  )
}

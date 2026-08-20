import { useMemo } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { TEMPLATES } from '@/features/templates/registry'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export function WizardStep2Template() {
  const templateId = useWizardStore((s) => s.templateId)
  const setTemplateId = useWizardStore((s) => s.setTemplateId)
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

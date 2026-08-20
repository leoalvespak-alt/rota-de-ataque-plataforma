import { useState, useMemo } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useUiStore } from '@/stores/useUiStore'
import { TEMPLATES, getTemplateById } from '@/features/templates/registry'
import { ProfileCanvasWrapper } from '@/features/templates/ProfileCanvasWrapper'
import { cn } from '@/lib/utils'
import {
  ArrowLeftRight,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseSensitive,
  Sun,
  Moon,
  Upload,
  Palette,
} from 'lucide-react'

const BRAND_COLORS = [
  { name: 'Vermelho', value: '#C1121F' },
  { name: 'Vermelho Escuro', value: '#8B0000' },
  { name: 'Dourado', value: '#D4A017' },
  { name: 'Light BG', value: '#F5F5F0' },
  { name: 'Dark BG', value: '#0A0A0A' },
  { name: 'Branco', value: '#FFFFFF' },
  { name: 'Preto', value: '#0A0A0A' },
]

export function WizardStep5Canvas() {
  const templateId = useWizardStore((s) => s.templateId)
  const scriptCards = useWizardStore((s) => s.scriptCards)
  const profileId = useWizardStore((s) => s.profileId)
  const selectTemplate = useEditorStore((s) => s.selectTemplate)
  const replaceElements = useEditorStore((s) => s.replaceElements)
  const setTab = useUiStore((s) => s.setTab)

  void selectTemplate; void replaceElements; void setTab

  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [cardDarkMode, setCardDarkMode] = useState<Record<number, boolean>>({})
  const [showTemplateSwap, setShowTemplateSwap] = useState(false)

  const [textStyles, setTextStyles] = useState({
    bold: false,
    italic: false,
    uppercase: false,
    align: 'left' as 'left' | 'center' | 'right',
  })

  const tpl = useMemo(() => (templateId ? getTemplateById(templateId) : null), [templateId])
  const filter = tpl?.filter

  const alternativeTemplates = useMemo(
    () => (filter ? TEMPLATES.filter((t) => t.filter === filter && t.id !== templateId) : []),
    [filter, templateId],
  )

  const activeCard = scriptCards[activeCardIndex]
  const isDark = cardDarkMode[activeCardIndex] ?? false

  const elements = useMemo(() => {
    if (!tpl || !activeCard) return {}
    return {
      ...tpl.defaults as Record<string, unknown>,
      title: activeCard.title,
      subtitle: activeCard.body,
      body: activeCard.body,
      eyebrow: activeCard.eyebrow ?? '',
    }
  }, [tpl, activeCard])

  const handleSwapTemplate = (newId: string) => {
    const newTpl = getTemplateById(newId)
    if (!newTpl) return
    useWizardStore.getState().setTemplateId(newId)
    setShowTemplateSwap(false)
  }


  if (!tpl) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ui-muted">
        Nenhum modelo selecionado.
      </div>
    )
  }

  const Render = tpl.Render

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col items-center justify-center bg-ui-panel2 p-6">
        {scriptCards.length > 1 && (
          <div className="mb-4 flex gap-2">
            {scriptCards.map((card, i) => (
              <button
                key={card.id}
                onClick={() => setActiveCardIndex(i)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  activeCardIndex === i
                    ? 'bg-brand-red text-white'
                    : 'bg-ui-panel text-ui-muted hover:text-ui-text',
                )}
              >
                {card.role === 'cover' ? 'Capa' : card.role === 'cta' ? 'CTA' : `Slide ${i}`}
              </button>
            ))}
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl border border-ui-border bg-white shadow-lg">
          <ProfileCanvasWrapper profileId={profileId}>
            <div
              className="pointer-events-none"
              style={{
                width: tpl.format === 'portrait' ? 1080 : 1080,
                height: tpl.format === 'portrait' ? 1920 : 1080,
                transform: 'scale(0.4)',
                transformOrigin: 'top left',
              }}
            >
              <Render elements={elements as never} dark={isDark} />
            </div>
          </ProfileCanvasWrapper>
        </div>
      </div>

      <div className="flex w-72 shrink-0 flex-col border-l border-ui-border bg-ui-panel overflow-y-auto">
        <div className="border-b border-ui-border p-4">
          <button
            onClick={() => setShowTemplateSwap(!showTemplateSwap)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-4 py-2.5 text-sm font-medium text-ui-text transition-colors hover:border-brand-red hover:text-brand-red"
          >
            <ArrowLeftRight className="size-4" />
            Trocar Modelo
          </button>

          {showTemplateSwap && (
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ui-border p-2">
              {alternativeTemplates.map((alt) => (
                <button
                  key={alt.id}
                  onClick={() => handleSwapTemplate(alt.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-ui-text hover:bg-ui-panel2"
                >
                  {alt.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-ui-border p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ui-muted">
            Formatação de Texto
          </h4>
          <div className="flex flex-wrap gap-1">
            <ToolbarButton
              active={textStyles.bold}
              onClick={() => setTextStyles((s) => ({ ...s, bold: !s.bold }))}
              title="Negrito"
            >
              <Bold className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              active={textStyles.italic}
              onClick={() => setTextStyles((s) => ({ ...s, italic: !s.italic }))}
              title="Itálico"
            >
              <Italic className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              active={textStyles.uppercase}
              onClick={() => setTextStyles((s) => ({ ...s, uppercase: !s.uppercase }))}
              title="Caixa alta/normal"
            >
              <CaseSensitive className="size-4" />
            </ToolbarButton>
            <div className="mx-1 w-px bg-ui-border" />
            <ToolbarButton
              active={textStyles.align === 'left'}
              onClick={() => setTextStyles((s) => ({ ...s, align: 'left' }))}
              title="Alinhar à esquerda"
            >
              <AlignLeft className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              active={textStyles.align === 'center'}
              onClick={() => setTextStyles((s) => ({ ...s, align: 'center' }))}
              title="Centralizar"
            >
              <AlignCenter className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              active={textStyles.align === 'right'}
              onClick={() => setTextStyles((s) => ({ ...s, align: 'right' }))}
              title="Alinhar à direita"
            >
              <AlignRight className="size-4" />
            </ToolbarButton>
          </div>
        </div>

        <div className="border-b border-ui-border p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ui-muted">
            Cores da Marca
          </h4>
          <div className="flex flex-wrap gap-2">
            {BRAND_COLORS.map((color) => (
              <button
                key={color.value}
                title={color.name}
                className="size-7 rounded-full border-2 border-ui-border transition-all hover:scale-110 hover:border-brand-red"
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>

        <div className="border-b border-ui-border p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ui-muted">
            Fundo
          </h4>
          <div className="space-y-2">
            <button className="flex w-full items-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-xs text-ui-text hover:border-brand-red">
              <Upload className="size-3.5" />
              Upload de imagem
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-xs text-ui-text hover:border-brand-red">
              <Palette className="size-3.5" />
              Cor sólida / SVG
            </button>
          </div>
        </div>

        <div className="p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ui-muted">
            Modo do Card
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCardDarkMode((s) => ({ ...s, [activeCardIndex]: false }))}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                !isDark
                  ? 'border-brand-red bg-brand-red/10 text-brand-red'
                  : 'border-ui-border text-ui-muted hover:border-brand-red/40',
              )}
            >
              <Sun className="size-3.5" />
              Light
            </button>
            <button
              onClick={() => setCardDarkMode((s) => ({ ...s, [activeCardIndex]: true }))}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                isDark
                  ? 'border-brand-red bg-brand-red/10 text-brand-red'
                  : 'border-ui-border text-ui-muted hover:border-brand-red/40',
              )}
            >
              <Moon className="size-3.5" />
              Dark
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-brand-red/15 text-brand-red'
          : 'text-ui-muted hover:bg-ui-panel2 hover:text-ui-text',
      )}
    >
      {children}
    </button>
  )
}

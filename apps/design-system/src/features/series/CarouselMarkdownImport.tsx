import { useRef, useState } from 'react'
import { FileText, Sparkles, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { generateCarouselCopy } from '@/lib/ai/generateCopy'
import { getDefaultElements } from '@/features/templates/registry'
import { useAIStore } from '@/stores/useAIStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useSeriesStore } from '@/stores/useSeriesStore'
import { HeaderPrimaryButton, HeaderSecondaryButton } from '@/app/HeaderButtons'

const CAREER_OPTIONS = [
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'policial', label: 'Policial' },
  { value: 'tribunal', label: 'Tribunal' },
  { value: 'geral', label: 'Geral' },
] as const

function textFieldsForTemplate(templateId: string) {
  return Object.entries(getDefaultElements(templateId))
    .filter(([field, value]) => field !== 'bgImg' && typeof value === 'string')
    .map(([field]) => field)
}

/** Importa uma pauta Markdown e distribui a copy nos cards já montados. */
export function CarouselMarkdownImport({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [markdown, setMarkdown] = useState('')
  const [fileName, setFileName] = useState('')
  const [career, setCareer] = useState<(typeof CAREER_OPTIONS)[number]['value']>('fiscal')
  const [loading, setLoading] = useState(false)
  const slides = useSeriesStore((state) => state.slides)
  const activeSlideId = useSeriesStore((state) => state.activeSlideId)
  const replaceSlides = useSeriesStore((state) => state.replaceSlides)
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId)
  const currentElements = useEditorStore((state) => state.elements)
  const replaceElements = useEditorStore((state) => state.replaceElements)
  const models = useAIStore((state) => state.models)
  const copyModel = useAIStore((state) => state.copyModel)
  const resolveKeyForModel = useAIStore((state) => state.resolveKeyForModel)
  const selectedModel = models.find((model) => model.id === copyModel) ?? models.find((model) => model.enabled)
  const apiKey = selectedModel ? resolveKeyForModel(selectedModel) : ''

  const handleFile = async (file?: File) => {
    if (!file) return
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast.error('Envie um arquivo Markdown (.md ou .markdown).')
      return
    }
    if (file.size > 1024 * 1024) {
      toast.error('O Markdown deve ter no máximo 1 MB.')
      return
    }
    const content = await file.text()
    if (!content.trim()) {
      toast.error('O arquivo Markdown está vazio.')
      return
    }
    setMarkdown(content)
    setFileName(file.name)
    toast.success('Markdown pronto para distribuir nos cards.')
  }

  const handleApply = async () => {
    if (!selectedModel || !apiKey) {
      toast.error('Configure um modelo de copy e sua chave na aba AI.')
      return
    }
    if (!markdown.trim()) {
      toast.error('Envie o Markdown da pauta primeiro.')
      return
    }
    if (slides.length === 0) {
      toast.error('Monte o carrossel antes de importar a copy.')
      return
    }

    setLoading(true)
    try {
      const copies = await generateCarouselCopy({
        model: selectedModel,
        apiKey,
        career,
        markdown,
        slides: slides.map((slide) => ({
          templateId: slide.templateId,
          availableFields: textFieldsForTemplate(slide.templateId),
        })),
      })
      const nextSlides = slides.map((slide, index) => ({
          ...slide,
          elements: { ...structuredClone(slide.elements), ...copies[index] },
        }))
      replaceSlides(nextSlides)
      const activeSlideIndex = activeSlideId
        ? slides.findIndex((slide) => slide.id === activeSlideId)
        : slides.findIndex(
            (slide) =>
              slide.templateId === activeTemplateId &&
              JSON.stringify(slide.elements) === JSON.stringify(currentElements),
          )
      if (activeSlideIndex >= 0) {
        const activeSlide = nextSlides[activeSlideIndex]!
        replaceElements(structuredClone(activeSlide.elements), { darkMode: activeSlide.darkMode })
      }
      toast.success(`Copy ajustado para os ${slides.length} cards. Selecione um card para revisar.`)
    } catch (error) {
      console.error('Carousel Markdown import error:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível ajustar a copy do carrossel.')
    } finally {
      setLoading(false)
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".md,.markdown,text/markdown,text/plain"
      className="sr-only"
      onChange={(event) => {
        void handleFile(event.target.files?.[0])
        event.currentTarget.value = ''
      }}
    />
  )

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        {fileInput}
        <HeaderSecondaryButton
          className="max-w-36 justify-center text-[11px]"
          title="Importar copy de um arquivo Markdown"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          <span className="truncate">{fileName || 'Importar Markdown'}</span>
        </HeaderSecondaryButton>
        <select
          aria-label="Contexto da copy do carrossel"
          value={career}
          onChange={(event) => setCareer(event.target.value as typeof career)}
          className="h-8 rounded-md border border-ui-border bg-ui-panel2 px-2 text-[11px] text-ui-text"
        >
          {CAREER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <HeaderPrimaryButton
          className="justify-center text-[11px]"
          disabled={loading || !markdown || slides.length === 0}
          onClick={() => void handleApply()}
          title="Distribuir a copy do Markdown nos cards com IA"
        >
          <Sparkles className="size-3.5" /> {loading ? 'Ajustando...' : 'Ajustar com IA'}
        </HeaderPrimaryButton>
      </div>
    )
  }

  return (
    <div className="flex min-w-[270px] flex-col gap-2 rounded-lg border border-ui-border bg-ui-panel2 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ui-text">
        <FileText className="size-3.5 text-brand-red" /> Copy do Markdown
      </div>
      {fileInput}
      <div className="flex items-center gap-1.5">
        <HeaderSecondaryButton className="flex-1 justify-center text-[11px]" onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" /> {fileName || 'Enviar .md'}
        </HeaderSecondaryButton>
        <select
          aria-label="Contexto da copy do carrossel"
          value={career}
          onChange={(event) => setCareer(event.target.value as typeof career)}
          className="h-8 rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] text-ui-text"
        >
          {CAREER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <HeaderPrimaryButton
        className="w-full justify-center text-[11px]"
        disabled={loading || !markdown || slides.length === 0}
        onClick={() => void handleApply()}
      >
        <Sparkles className="size-3.5" /> {loading ? 'Ajustando cards...' : 'Ajustar copy com IA'}
      </HeaderPrimaryButton>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Keyboard, Layers3, Plus } from 'lucide-react'
import { useSeriesStore } from '@/stores/useSeriesStore'
import { useEditorStore, getDefaultElements } from '@/stores/useEditorStore'
import { useDecorStore } from '@/stores/useDecorStore'
import { SeriesSlideCard } from './SeriesSlideCard'
import { CarouselMarkdownImport } from './CarouselMarkdownImport'
import { HeaderSecondaryButton } from '@/app/HeaderButtons'

/** Faixa visual do carrossel: prévias fiéis, navegação, reordenação e criação de cards. */
export function SeriesBar() {
  const seriesMode = useSeriesStore((state) => state.seriesMode)
  const slides = useSeriesStore((state) => state.slides)
  const activeSlideId = useSeriesStore((state) => state.activeSlideId)
  const addSlide = useSeriesStore((state) => state.addSlide)
  const updateSlide = useSeriesStore((state) => state.updateSlide)
  const setActiveSlide = useSeriesStore((state) => state.setActiveSlide)
  const deleteSlide = useSeriesStore((state) => state.deleteSlide)
  const reorderSlides = useSeriesStore((state) => state.reorderSlides)

  const activeTemplateId = useEditorStore((state) => state.activeTemplateId)
  const elements = useEditorStore((state) => state.elements)
  const darkMode = useEditorStore((state) => state.darkMode)
  const selectTemplate = useEditorStore((state) => state.selectTemplate)
  const replaceElements = useEditorStore((state) => state.replaceElements)
  const watermark = useDecorStore((state) => state.watermark)
  const texture = useDecorStore((state) => state.texture)
  const stripRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!seriesMode || !activeSlideId || !activeTemplateId) return
    updateSlide(activeSlideId, {
      templateId: activeTemplateId,
      elements: structuredClone(elements),
      darkMode,
      watermark: structuredClone(watermark),
      texture: structuredClone(texture),
    })
  }, [activeSlideId, activeTemplateId, darkMode, elements, seriesMode, texture, updateSlide, watermark])

  useEffect(() => {
    if (!activeSlideId) return
    const activeCard = stripRef.current?.querySelector<HTMLElement>(`[data-slide-id="${activeSlideId}"]`)
    activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeSlideId])

  const handleAddSlide = () => {
    if (!activeTemplateId) return
    const nextElements = structuredClone(getDefaultElements(activeTemplateId))
    addSlide({
      templateId: activeTemplateId,
      elements: nextElements,
      darkMode,
      watermark: structuredClone(watermark),
      texture: structuredClone(texture),
    })
    replaceElements(nextElements, { darkMode })
  }

  const handleLoadSlide = (id: string) => {
    const slide = useSeriesStore.getState().slides.find((item) => item.id === id)
    if (!slide) return
    replaceElements(structuredClone(slide.elements), { darkMode: slide.darkMode })
    useDecorStore.setState({
      watermark: structuredClone(slide.watermark),
      texture: structuredClone(slide.texture),
    })
    selectTemplate(slide.templateId, { keepElements: true })
    setActiveSlide(id)
  }

  const handleDeleteSlide = (id: string) => {
    const currentSlides = useSeriesStore.getState().slides
    const deletedIndex = currentSlides.findIndex((slide) => slide.id === id)
    const nextSlide = activeSlideId === id
      ? currentSlides[deletedIndex + 1] ?? currentSlides[deletedIndex - 1]
      : undefined
    deleteSlide(id)
    if (nextSlide) handleLoadSlide(nextSlide.id)
  }

  const handleNavigate = (direction: -1 | 1) => {
    if (slides.length === 0) return
    const activeIndex = slides.findIndex((slide) => slide.id === activeSlideId)
    const nextIndex = activeIndex < 0
      ? 0
      : Math.min(slides.length - 1, Math.max(0, activeIndex + direction))
    handleLoadSlide(slides[nextIndex]!.id)
  }

  useEffect(() => {
    if (!seriesMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) return
      event.preventDefault()
      handleNavigate(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = slides.findIndex((slide) => slide.id === active.id)
    const toIndex = slides.findIndex((slide) => slide.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    reorderSlides(fromIndex, toIndex)
  }

  const activeIndex = slides.findIndex((slide) => slide.id === activeSlideId)

  if (!seriesMode) return null

  return (
    <section className="shrink-0 border-b border-ui-border bg-ui-panel" aria-label="Cards do carrossel">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-ui-border/70 px-4 py-2">
        <div className="mr-auto flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-red/12 text-brand-red">
            <Layers3 className="size-4" />
          </span>
          <div>
            <h2 className="text-xs font-semibold text-ui-text">Cards do carrossel</h2>
            <p className="text-[10px] text-ui-muted">
              {collapsed
                ? 'Use as setas do teclado para navegar'
                : `${slides.length} card${slides.length === 1 ? '' : 's'} · clique para editar, arraste para ordenar`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <HeaderSecondaryButton
            aria-label="Card anterior"
            title="Card anterior"
            disabled={activeIndex <= 0}
            onClick={() => handleNavigate(-1)}
          >
            <ChevronLeft className="size-4" />
          </HeaderSecondaryButton>
          <span className="min-w-12 text-center text-[11px] tabular-nums text-ui-muted">
            {slides.length === 0 ? '0 / 0' : `${Math.max(0, activeIndex) + 1} / ${slides.length}`}
          </span>
          <HeaderSecondaryButton
            aria-label="Próximo card"
            title="Próximo card"
            disabled={activeIndex < 0 || activeIndex >= slides.length - 1}
            onClick={() => handleNavigate(1)}
          >
            <ChevronRight className="size-4" />
          </HeaderSecondaryButton>
        </div>
        <HeaderSecondaryButton onClick={handleAddSlide} title="Adicionar um novo slide com o layout atual">
          <Plus className="size-3.5" /> Novo slide
        </HeaderSecondaryButton>
        {!collapsed && <CarouselMarkdownImport compact />}
        <HeaderSecondaryButton
          aria-label={collapsed ? 'Mostrar faixa de cards' : 'Recolher faixa de cards'}
          title={collapsed ? 'Mostrar faixa de cards' : 'Recolher faixa de cards'}
          onClick={() => setCollapsed((value) => !value)}
          className="px-2.5"
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </HeaderSecondaryButton>
      </div>

      {!collapsed && <div ref={stripRef} className="overflow-x-auto px-4 py-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((slide) => slide.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex min-w-max items-stretch gap-3">
              {slides.map((slide, index) => (
                <SeriesSlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  active={slide.id === activeSlideId}
                  onLoad={handleLoadSlide}
                  onDelete={handleDeleteSlide}
                />
              ))}
              <button
                type="button"
                onClick={handleAddSlide}
                className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ui-border bg-ui-panel2 px-3 text-center text-ui-muted transition-colors hover:border-brand-red hover:bg-brand-red/5 hover:text-brand-red"
              >
                <span className="grid size-9 place-items-center rounded-full border border-current">
                  <Plus className="size-4" />
                </span>
                <span className="text-[11px] font-semibold">Adicionar slide</span>
                <span className="text-[9px] leading-tight opacity-75">Usa o layout atual</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>
      </div>}
      {collapsed && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-[10px] text-ui-muted">
          <Keyboard className="size-3.5" /> Setas ← → alternam entre os cards sem ocupar a tela.
        </div>
      )}
    </section>
  )
}

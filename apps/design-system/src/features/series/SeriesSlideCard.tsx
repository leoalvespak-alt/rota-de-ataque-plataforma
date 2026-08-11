import { GripVertical, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SeriesSlide } from '@/stores/useSeriesStore'
import { getTemplateById } from '@/features/templates/registry'
import { TemplateThumb } from '@/features/editor/Gallery/TemplateThumb'
import { cn } from '@/lib/utils'

interface SeriesSlideCardProps {
  slide: SeriesSlide
  index: number
  active: boolean
  onLoad: (id: string) => void
  onDelete: (id: string) => void
}

/** Miniatura fiel, navegável e reordenável de um card do carrossel. */
export function SeriesSlideCard({ slide, index, active, onLoad, onDelete }: SeriesSlideCardProps) {
  const template = getTemplateById(slide.templateId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      data-slide-id={slide.id}
      className={cn(
        'group relative w-32 shrink-0 overflow-hidden rounded-xl border bg-ui-panel2 shadow-sm transition-all',
        active
          ? 'border-brand-red ring-2 ring-brand-red/25'
          : 'border-ui-border hover:border-ui-muted',
      )}
    >
      <button
        type="button"
        onClick={() => onLoad(slide.id)}
        aria-label={`Abrir card ${index + 1}`}
        aria-current={active ? 'step' : undefined}
        className="block w-full bg-white text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-inset"
      >
        {template ? (
          <TemplateThumb
            template={template}
            elements={slide.elements}
            dark={slide.darkMode}
          />
        ) : (
          <div className="grid aspect-square place-items-center bg-ui-panel text-xs text-ui-muted">
            Prévia indisponível
          </div>
        )}
      </button>

      <div className="flex items-center gap-1.5 border-t border-ui-border px-2 py-1.5">
        <span className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
          active ? 'bg-brand-red text-white' : 'bg-ui-panel text-ui-muted',
        )}>
          {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onLoad(slide.id)}
          className="min-w-0 flex-1 truncate text-left text-[10px] font-medium text-ui-text"
          title={template?.name ?? slide.templateId}
        >
          {template?.name ?? slide.templateId}
        </button>
        <button
          type="button"
          aria-label={`Reordenar card ${index + 1}`}
          title="Arraste para reordenar"
          className="cursor-grab rounded p-0.5 text-ui-muted hover:text-ui-text active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Excluir card ${index + 1}`}
          title="Excluir card"
          onClick={() => onDelete(slide.id)}
          className="rounded p-0.5 text-ui-muted hover:bg-brand-red/10 hover:text-brand-red"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </article>
  )
}

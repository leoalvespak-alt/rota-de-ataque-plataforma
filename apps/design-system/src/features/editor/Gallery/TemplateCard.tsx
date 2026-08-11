import { Check, Image as ImageIcon, List, MousePointerClick, Star } from 'lucide-react'
import type { TemplateDefinition } from '@/features/templates/types'
import { cn } from '@/lib/utils'
import { TemplateThumb } from './TemplateThumb'
import { getTemplateLibraryCapabilities } from './templateLibrary'

interface TemplateCardProps {
  template: TemplateDefinition<never>
  active: boolean
  favorite: boolean
  compact?: boolean
  selectionMode?: boolean
  selected?: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}

const FORMAT_LABELS = {
  square: 'Quadrado',
  portrait: 'Story',
  carousel: 'Carrossel',
} as const

export function TemplateCard({
  template,
  active,
  favorite,
  compact = false,
  selectionMode = false,
  selected = false,
  onSelect,
  onToggleFavorite,
}: TemplateCardProps) {
  const capabilities = getTemplateLibraryCapabilities(template)

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-ui-panel2 transition-all hover:-translate-y-0.5 hover:border-ui-muted hover:shadow-xl focus-within:border-ui-muted',
        active || selected ? 'border-brand-red ring-1 ring-brand-red/30' : 'border-ui-border',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={selectionMode ? `Selecionar modelo ${template.name} para o carrossel` : `Criar edição com o modelo ${template.name}`}
        className="relative block w-full overflow-hidden bg-white text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-inset"
      >
        <TemplateThumb template={template} />
        {selected ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-1 text-[9px] font-bold tracking-wide text-white uppercase shadow-lg">
            <Check className="size-3" /> Selecionado
          </span>
        ) : active && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-1 text-[9px] font-bold tracking-wide text-white uppercase shadow-lg">
            <Check className="size-3" /> Em uso
          </span>
        )}
      </button>

      <button
        type="button"
        aria-label={
          favorite
            ? `Remover ${template.name} dos favoritos`
            : `Adicionar ${template.name} aos favoritos`
        }
        aria-pressed={favorite}
        title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        onClick={onToggleFavorite}
        className={cn(
          'absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full border border-black/10 bg-black/65 text-white shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-brand-red focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
          favorite && 'bg-brand-red',
        )}
      >
        <Star className="size-4" fill={favorite ? 'currentColor' : 'none'} />
      </button>

      <div className={cn('border-t border-ui-border', compact ? 'px-2.5 py-2' : 'p-3')}>
        <button type="button" onClick={onSelect} className="block w-full text-left outline-none">
          <span
            className={cn(
              'block truncate font-medium text-ui-text',
              compact ? 'text-[11px]' : 'text-sm',
            )}
          >
            {template.name}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-ui-muted">
            {FORMAT_LABELS[template.filter]} · {template.category}
          </span>
        </button>

        {!compact && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {capabilities?.image && <CapabilityBadge icon={ImageIcon}>Imagem</CapabilityBadge>}
            {capabilities?.list && <CapabilityBadge icon={List}>Lista</CapabilityBadge>}
            {capabilities?.cta && <CapabilityBadge icon={MousePointerClick}>CTA</CapabilityBadge>}
            <button
              type="button"
              onClick={onSelect}
              className="ml-auto rounded-md bg-brand-red px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-red-hover focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-ui-panel2 focus-visible:outline-none"
            >
              {selectionMode ? (selected ? 'Selecionado' : 'Selecionar') : 'Criar edição'}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function CapabilityBadge({
  icon: Icon,
  children,
}: {
  icon: typeof ImageIcon
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-[9px] text-ui-muted">
      <Icon className="size-3" /> {children}
    </span>
  )
}

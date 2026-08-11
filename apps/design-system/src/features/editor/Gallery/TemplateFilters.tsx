import { Check, ChevronDown, Clock3, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTemplateLibraryStore, type TemplateLibraryView } from '@/stores/useTemplateLibraryStore'
import {
  CAPABILITY_OPTIONS,
  FORMAT_OPTIONS,
  SEGMENT_OPTIONS,
  getActiveFilterCount,
} from './templateLibrary'

const VIEW_OPTIONS: { id: TemplateLibraryView; label: string; icon?: typeof Star }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'favorites', label: 'Favoritos', icon: Star },
  { id: 'recent', label: 'Recentes', icon: Clock3 },
]

export function TemplateSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const query = useTemplateLibraryStore((state) => state.query)
  const setQuery = useTemplateLibraryStore((state) => state.setQuery)

  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ui-muted" />
      <Input
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar modelos..."
        aria-label="Buscar modelos"
        className="border-ui-border bg-ui-panel2 pr-8 pl-8 text-ui-text placeholder:text-ui-muted"
      />
      {query && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => setQuery('')}
          className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-ui-muted hover:bg-ui-panel hover:text-ui-text"
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  )
}

export function LibraryViewTabs({ compact = false }: { compact?: boolean }) {
  const view = useTemplateLibraryStore((state) => state.view)
  const setView = useTemplateLibraryStore((state) => state.setView)
  const favoriteCount = useTemplateLibraryStore((state) => state.favoriteIds.length)

  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-lg bg-ui-panel2 p-1"
      aria-label="Visualização dos modelos"
    >
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={view === option.id}
            onClick={() => setView(option.id)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-ui-muted transition-colors hover:text-ui-text',
              view === option.id && 'bg-ui-panel text-ui-text shadow-sm',
            )}
          >
            {Icon && (
              <Icon
                className="size-3 shrink-0"
                fill={option.id === 'favorites' && view === option.id ? 'currentColor' : 'none'}
              />
            )}
            <span className={compact ? 'truncate' : ''}>{option.label}</span>
            {option.id === 'favorites' && favoriteCount > 0 && (
              <span className="text-[9px] text-brand-red">{favoriteCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function CompactTemplateFilters() {
  const format = useTemplateLibraryStore((state) => state.format)
  const segments = useTemplateLibraryStore((state) => state.segments)
  const capabilities = useTemplateLibraryStore((state) => state.capabilities)
  const setFormat = useTemplateLibraryStore((state) => state.setFormat)
  const toggleSegment = useTemplateLibraryStore((state) => state.toggleSegment)
  const toggleCapability = useTemplateLibraryStore((state) => state.toggleCapability)
  const resetFilters = useTemplateLibraryStore((state) => state.resetFilters)
  const query = useTemplateLibraryStore((state) => state.query)
  const view = useTemplateLibraryStore((state) => state.view)
  const activeCount = getActiveFilterCount({ query, format, segments, capabilities, view })

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Select value={format} onValueChange={(value) => setFormat(value as typeof format)}>
        <SelectTrigger
          aria-label="Filtrar por formato"
          className="w-full border-ui-border bg-ui-panel2 text-[11px] text-ui-text"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 items-center justify-between rounded-lg border border-ui-border bg-ui-panel2 px-2.5 text-[11px] text-ui-text hover:border-brand-red"
          >
            <span>
              {segments.length
                ? `${segments.length} segmento${segments.length > 1 ? 's' : ''}`
                : 'Segmentos'}
            </span>
            <ChevronDown className="size-3.5 text-ui-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 border border-ui-border bg-ui-panel text-ui-text"
        >
          <p className="text-[10px] font-semibold tracking-wide text-ui-muted uppercase">
            Segmentos
          </p>
          {SEGMENT_OPTIONS.map((option) => (
            <FilterCheck
              key={option.id}
              checked={segments.includes(option.id)}
              onClick={() => toggleSegment(option.id)}
            >
              {option.label}
            </FilterCheck>
          ))}
          <div className="my-1 h-px bg-ui-border" />
          <p className="text-[10px] font-semibold tracking-wide text-ui-muted uppercase">
            Recursos
          </p>
          {CAPABILITY_OPTIONS.map((option) => (
            <FilterCheck
              key={option.id}
              checked={capabilities.includes(option.id)}
              onClick={() => toggleCapability(option.id)}
            >
              {option.label}
            </FilterCheck>
          ))}
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={resetFilters}
          className="col-span-2 inline-flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-ui-muted hover:text-brand-red"
        >
          <SlidersHorizontal className="size-3" /> Limpar {activeCount} filtro
          {activeCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

export function FullTemplateFilters() {
  const format = useTemplateLibraryStore((state) => state.format)
  const segments = useTemplateLibraryStore((state) => state.segments)
  const capabilities = useTemplateLibraryStore((state) => state.capabilities)
  const setFormat = useTemplateLibraryStore((state) => state.setFormat)
  const toggleSegment = useTemplateLibraryStore((state) => state.toggleSegment)
  const toggleCapability = useTemplateLibraryStore((state) => state.toggleCapability)

  return (
    <aside className="w-full shrink-0 border-b border-ui-border bg-ui-panel p-4 lg:w-56 lg:border-r lg:border-b-0 lg:p-5">
      <FilterGroup title="Formato">
        {FORMAT_OPTIONS.map((option) => (
          <FilterCheck
            key={option.id}
            checked={format === option.id}
            onClick={() => setFormat(option.id)}
            radio
          >
            {option.label}
          </FilterCheck>
        ))}
      </FilterGroup>
      <FilterGroup title="Segmento">
        {SEGMENT_OPTIONS.map((option) => (
          <FilterCheck
            key={option.id}
            checked={segments.includes(option.id)}
            onClick={() => toggleSegment(option.id)}
          >
            {option.label}
          </FilterCheck>
        ))}
      </FilterGroup>
      <FilterGroup title="Recursos">
        {CAPABILITY_OPTIONS.map((option) => (
          <FilterCheck
            key={option.id}
            checked={capabilities.includes(option.id)}
            onClick={() => toggleCapability(option.id)}
          >
            {option.label}
          </FilterCheck>
        ))}
      </FilterGroup>
    </aside>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-2 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase">
        {title}
      </legend>
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">{children}</div>
    </fieldset>
  )
}

function FilterCheck({
  checked,
  onClick,
  children,
  radio = false,
}: {
  checked: boolean
  onClick: () => void
  children: React.ReactNode
  radio?: boolean
}) {
  return (
    <button
      type="button"
      role={radio ? 'radio' : 'checkbox'}
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ui-muted transition-colors hover:bg-ui-panel2 hover:text-ui-text',
        checked && 'bg-brand-red/12 font-medium text-brand-red',
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center border border-ui-border',
          radio ? 'rounded-full' : 'rounded',
        )}
      >
        {checked &&
          (radio ? (
            <span className="size-2 rounded-full bg-brand-red" />
          ) : (
            <Check className="size-3 text-brand-red" />
          ))}
      </span>
      {children}
    </button>
  )
}

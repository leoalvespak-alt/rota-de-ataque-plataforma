import { useEffect, useRef } from 'react'
import { ArrowLeft, LayoutGrid, Layers3, RotateCcw, SearchX, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TEMPLATES } from '@/features/templates/registry'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTemplateLibraryStore } from '@/stores/useTemplateLibraryStore'
import { useCreateEdition } from '@/features/editions/useCreateEdition'
import { TemplateCard } from './TemplateCard'
import { FullTemplateFilters, LibraryViewTabs, TemplateSearch } from './TemplateFilters'
import { filterTemplates, getActiveFilterCount } from './templateLibrary'

export function TemplateLibraryView() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId)
  const library = useTemplateLibraryStore()
  const closeLibrary = useTemplateLibraryStore((state) => state.closeLibrary)
  const createEdition = useCreateEdition()
  const filtered = filterTemplates(TEMPLATES, library)
  const activeFilterCount = getActiveFilterCount(library)

  useEffect(() => {
    headingRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLibrary()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeLibrary])

  const handleUseTemplate = async (templateId: string) => {
    const edition = await createEdition([templateId])
    if (!edition) return
    library.markRecent(templateId)
    closeLibrary()
  }

  const handleCreateCarousel = async () => {
    if (library.selectedCarouselTemplateIds.length === 0) return
    const edition = await createEdition(library.selectedCarouselTemplateIds)
    if (!edition) return
    library.selectedCarouselTemplateIds.forEach((templateId) => library.markRecent(templateId))
    library.clearCarouselSelection()
    closeLibrary()
  }

  return (
    <section
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-ui-bg text-ui-text"
      aria-labelledby="template-library-title"
    >
      <header className="shrink-0 border-b border-ui-border bg-ui-panel px-4 py-3 lg:px-6 lg:py-4">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={closeLibrary}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel2 px-3 text-xs text-ui-text transition-colors hover:border-brand-red hover:text-brand-red"
            >
              <ArrowLeft className="size-4" /> Voltar ao editor
            </button>
            <div className="min-w-0">
              <h1
                ref={headingRef}
                tabIndex={-1}
                id="template-library-title"
                className="font-heading text-lg font-bold tracking-wide uppercase outline-none lg:text-xl"
              >
                Biblioteca de modelos
              </h1>
              <p className="text-xs text-ui-muted">
                {library.carouselSelectionMode
                  ? 'Selecione os layouts que formarão seu carrossel.'
                  : 'Use um modelo como ponto de partida. A biblioteca nunca é alterada.'}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {library.carouselSelectionMode ? (
                <>
                  <button
                    type="button"
                    onClick={library.clearCarouselSelection}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel2 px-3 text-xs text-ui-muted hover:text-ui-text"
                  >
                    <X className="size-3.5" /> Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={library.selectedCarouselTemplateIds.length === 0}
                    onClick={() => void handleCreateCarousel()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-red px-3 text-xs font-semibold text-white hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Layers3 className="size-3.5" /> Criar carrossel ({library.selectedCarouselTemplateIds.length})
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={library.startCarouselSelection}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-red/50 bg-brand-red/10 px-3 text-xs font-semibold text-brand-red hover:bg-brand-red hover:text-white"
                >
                  <Layers3 className="size-3.5" /> Montar carrossel
                </button>
              )}
            </div>
          </div>

          <div className="grid items-center gap-2 md:grid-cols-[minmax(240px,1fr)_minmax(280px,420px)_180px]">
            <LibraryViewTabs />
            <TemplateSearch />
            <Select
              value={library.sort}
              onValueChange={(value) => library.setSort(value as typeof library.sort)}
            >
              <SelectTrigger
                aria-label="Ordenar modelos"
                className="w-full border-ui-border bg-ui-panel2 text-xs text-ui-text"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Ordem recomendada</SelectItem>
                <SelectItem value="name">Nome A–Z</SelectItem>
                <SelectItem value="recent">Usados recentemente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <FullTemplateFilters />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutGrid className="size-4 text-brand-red" />
                <p className="text-sm font-medium" aria-live="polite">
                  {filtered.length} modelo{filtered.length === 1 ? '' : 's'} encontrado
                  {filtered.length === 1 ? '' : 's'}
                </p>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={library.resetFilters}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ui-muted hover:bg-ui-panel2 hover:text-brand-red"
                >
                  <RotateCcw className="size-3.5" /> Limpar filtros
                </button>
              )}
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filtered.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    active={activeTemplateId === template.id}
                    favorite={library.favoriteIds.includes(template.id)}
                    selectionMode={library.carouselSelectionMode}
                    selected={library.selectedCarouselTemplateIds.includes(template.id)}
                    onSelect={() => {
                      if (library.carouselSelectionMode) {
                        library.toggleCarouselTemplate(template.id)
                      } else {
                        void handleUseTemplate(template.id)
                      }
                    }}
                    onToggleFavorite={() => library.toggleFavorite(template.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-ui-border bg-ui-panel/50 px-6 text-center">
                <SearchX className="mb-3 size-9 text-ui-muted" />
                <h2 className="font-heading text-base font-bold text-ui-text uppercase">
                  Nenhum modelo encontrado
                </h2>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-ui-muted">
                  Ajuste a busca ou remova alguns filtros para voltar a ver os modelos disponíveis.
                </p>
                <button
                  type="button"
                  onClick={library.resetFilters}
                  className="mt-4 rounded-lg bg-brand-red px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red-hover"
                >
                  Mostrar todos
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </section>
  )
}

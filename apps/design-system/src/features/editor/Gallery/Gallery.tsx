import { BookOpenText, FolderKanban, Layers3, LayoutTemplate, Maximize2, SearchX } from 'lucide-react'
import { TEMPLATES } from '@/features/templates/registry'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTemplateLibraryStore } from '@/stores/useTemplateLibraryStore'
import { useUiStore } from '@/stores/useUiStore'
import { TemplateCard } from './TemplateCard'
import { CompactTemplateFilters, LibraryViewTabs, TemplateSearch } from './TemplateFilters'
import { filterTemplates } from './templateLibrary'
import { useCreateEdition } from '@/features/editions/useCreateEdition'
import { EditionsGallery } from '@/features/editions/EditionsGallery'
import { cn } from '@/lib/utils'

export function Gallery() {
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId)
  const closePanels = useUiStore((state) => state.closePanels)
  const setTab = useUiStore((state) => state.setTab)
  const library = useTemplateLibraryStore()
  const createEdition = useCreateEdition()

  const filtered = filterTemplates(TEMPLATES, library)
  const categories = [...new Set(filtered.map((template) => template.category))]

  const handleUseTemplate = async (templateId: string) => {
    const edition = await createEdition([templateId])
    if (!edition) return
    library.markRecent(templateId)
    closePanels()
  }

  const openLibrary = () => {
    closePanels()
    library.openLibrary()
  }

  const openCarouselComposer = () => {
    closePanels()
    library.startCarouselSelection()
    library.openLibrary()
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-ui-border bg-ui-panel">
      <div className="grid grid-cols-3 gap-1 border-b border-ui-border bg-ui-panel px-2 pt-2">
        <GalleryTab
          active={library.panelTab === 'models'}
          icon={LayoutTemplate}
          label="Modelos"
          onClick={() => library.setPanelTab('models')}
        />
        <GalleryTab
          active={library.panelTab === 'editions'}
          icon={FolderKanban}
          label="Edições"
          onClick={() => library.setPanelTab('editions')}
        />
        <GalleryTab
          active={false}
          icon={BookOpenText}
          label="Teses"
          onClick={() => setTab('editorial')}
        />
      </div>

      {library.panelTab === 'editions' ? (
        <EditionsGallery onBrowseTemplates={() => library.setPanelTab('models')} />
      ) : (
        <>
          <div className="space-y-2.5 border-b border-ui-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="size-4 text-brand-red" />
                <div>
                  <h2 className="font-heading text-xs font-bold tracking-wide text-ui-text uppercase">
                    Biblioteca de modelos
                  </h2>
                  <p className="text-[10px] text-ui-muted">{TEMPLATES.length} layouts prontos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openLibrary}
                title="Abrir biblioteca em tela cheia"
                aria-label="Abrir biblioteca de modelos em tela cheia"
                className="flex size-8 items-center justify-center rounded-lg border border-ui-border bg-ui-panel2 text-ui-muted transition-colors hover:border-brand-red hover:text-brand-red"
              >
                <Maximize2 className="size-4" />
              </button>
            </div>
            <TemplateSearch />
            <LibraryViewTabs compact />
            <CompactTemplateFilters />
            <button
              type="button"
              onClick={openCarouselComposer}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-red/40 bg-brand-red/10 px-2 py-2 text-[11px] font-semibold text-brand-red hover:bg-brand-red hover:text-white"
            >
              <Layers3 className="size-3.5" /> Montar carrossel
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-ui-border px-3 py-2 text-[10px] text-ui-muted">
            <span aria-live="polite">
              {filtered.length} modelo{filtered.length === 1 ? '' : 's'}
            </span>
            <button type="button" onClick={openLibrary} className="font-medium hover:text-brand-red">
              Ver em grade
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <SearchX className="mb-2 size-6 text-ui-muted" />
                <p className="text-xs font-medium text-ui-text">Nenhum modelo encontrado</p>
                <p className="mt-1 text-[10px] leading-relaxed text-ui-muted">
                  Tente remover algum filtro ou buscar outro termo.
                </p>
                <button
                  type="button"
                  onClick={library.resetFilters}
                  className="mt-3 text-[11px] font-medium text-brand-red hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {categories.map((category) => (
              <section key={category} className="mb-4" aria-label={category}>
                <div className="mb-1.5 flex items-center gap-1.5 px-1.5 text-[10px] font-semibold tracking-[0.08em] text-ui-muted uppercase">
                  {category}
                  <div className="h-px flex-1 bg-ui-border" />
                </div>
                <div className="space-y-2">
                  {filtered
                    .filter((template) => template.category === category)
                    .map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        compact
                        active={activeTemplateId === template.id}
                        favorite={library.favoriteIds.includes(template.id)}
                        onSelect={() => void handleUseTemplate(template.id)}
                        onToggleFavorite={() => library.toggleFavorite(template.id)}
                      />
                    ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

function GalleryTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof LayoutTemplate
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-t-lg border-b-2 px-2 py-2.5 text-[11px] font-semibold transition-colors',
        active
          ? 'border-brand-red bg-ui-panel2 text-ui-text'
          : 'border-transparent text-ui-muted hover:bg-ui-panel2/60 hover:text-ui-text',
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  )
}

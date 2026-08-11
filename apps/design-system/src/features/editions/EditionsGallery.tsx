import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, FolderOpen, Layers3, RefreshCw, Search, Shapes, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectDocument } from '@/domain/documents'
import { ProjectRepository } from '@/domain/repositories'
import { Input } from '@/components/ui/input'
import { getTemplateById } from '@/features/templates/registry'
import { TemplateThumb } from '@/features/editor/Gallery/TemplateThumb'
import { useProjectSessionStore } from '@/stores/useProjectSessionStore'
import { cn } from '@/lib/utils'
import { ensureEditorialSeedEditions } from './editorialSeed'

type EditionType = 'all' | 'carousel' | 'post' | 'story'

function getArtifact(project: ProjectDocument) {
  return project.campaigns[0]?.artifacts[0]
}

function getCategory(project: ProjectDocument) {
  const thesis = project.name.match(/^Tese\s+\d+/i)?.[0]
  if (thesis) return thesis.replace(/^tese/i, 'Tese')
  const campaign = project.campaigns[0]?.name
  return campaign && campaign !== 'Conteúdo editorial' && campaign !== 'Campanha padrão'
    ? campaign
    : 'Outras edições'
}

function getTypeLabel(kind?: EditionType) {
  if (kind === 'carousel') return 'Carrossel'
  if (kind === 'story') return 'Story'
  return 'Post'
}

export function EditionsGallery({ onBrowseTemplates }: { onBrowseTemplates: () => void }) {
  const repository = useMemo(() => new ProjectRepository(), [])
  const [editions, setEditions] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<EditionType>('all')
  const [category, setCategory] = useState('all')
  const activeEdition = useProjectSessionStore((state) => state.project)
  const activeEditionId = activeEdition?.id
  const setProject = useProjectSessionStore((state) => state.setProject)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await ensureEditorialSeedEditions(repository)
      const projects = await repository.list()
      setEditions(projects.sort((left, right) => right.updatedAt - left.updatedAt))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as edições.')
    } finally {
      setLoading(false)
    }
  }, [repository])

  useEffect(() => {
    let active = true
    void ensureEditorialSeedEditions(repository)
      .then(() => repository.list())
      .then((projects) => {
        if (active) setEditions(projects.sort((left, right) => right.updatedAt - left.updatedAt))
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as edições.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [repository])

  const visibleEditions = useMemo(() => {
    if (!activeEdition) return editions
    const next = editions.some((edition) => edition.id === activeEdition.id)
      ? editions.map((edition) => edition.id === activeEdition.id ? activeEdition : edition)
      : [activeEdition, ...editions]
    return next.sort((left, right) => right.updatedAt - left.updatedAt)
  }, [activeEdition, editions])

  const categories = useMemo(
    () => [...new Set(visibleEditions.map(getCategory))].sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })),
    [visibleEditions],
  )

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return visibleEditions.filter((edition) => {
      const artifact = getArtifact(edition)
      return (!normalizedQuery || edition.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
        && (type === 'all' || artifact?.kind === type)
        && (category === 'all' || getCategory(edition) === category)
    })
  }, [category, query, type, visibleEditions])

  const grouped = useMemo(
    () => categories
      .map((name) => ({ name, editions: filtered.filter((edition) => getCategory(edition) === name) }))
      .filter((group) => group.editions.length > 0),
    [categories, filtered],
  )

  const openEdition = (edition: ProjectDocument) => {
    setProject(edition)
    toast.success('Edição aberta para continuar.')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-ui-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-xs font-bold tracking-wide text-ui-text uppercase">
              Suas edições
            </h2>
            <p className="text-[10px] text-ui-muted">Continue de onde parou sem alterar os modelos</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Atualizar edições"
            title="Atualizar edições"
            className="grid size-8 place-items-center rounded-lg border border-ui-border bg-ui-panel2 text-ui-muted hover:border-brand-red hover:text-brand-red"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ui-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar edições..."
            aria-label="Buscar edições"
            className="border-ui-border bg-ui-panel2 pr-8 pl-8 text-ui-text placeholder:text-ui-muted"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpar busca de edições"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-ui-muted hover:bg-ui-panel hover:text-ui-text"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>

        <div className="grid grid-cols-2 gap-1.5">
          <select
            aria-label="Filtrar edições por tipo"
            value={type}
            onChange={(event) => setType(event.target.value as EditionType)}
            className="h-8 min-w-0 rounded-lg border border-ui-border bg-ui-panel2 px-2 text-[11px] text-ui-text"
          >
            <option value="all">Todos os tipos</option>
            <option value="carousel">Carrosséis</option>
            <option value="post">Posts</option>
            <option value="story">Stories</option>
          </select>
          <select
            aria-label="Filtrar edições por categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-8 min-w-0 rounded-lg border border-ui-border bg-ui-panel2 px-2 text-[11px] text-ui-text"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-ui-border px-3 py-2 text-[10px] text-ui-muted">
        <span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</span>
        <button type="button" onClick={onBrowseTemplates} className="font-medium text-brand-red hover:underline">
          + Nova edição
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <FolderOpen className="mb-2 size-7 text-ui-muted" />
            <p className="text-xs font-medium text-ui-text">Nenhuma edição encontrada</p>
            <p className="mt-1 text-[10px] leading-relaxed text-ui-muted">Ajuste os filtros ou escolha um modelo.</p>
            <button type="button" onClick={onBrowseTemplates} className="mt-3 text-[11px] font-medium text-brand-red hover:underline">
              Ver modelos
            </button>
          </div>
        )}

        {grouped.map((group) => (
          <section key={group.name} className="mb-4" aria-label={group.name}>
            <div className="mb-1.5 flex items-center gap-1.5 px-1.5 text-[10px] font-semibold tracking-[0.08em] text-ui-muted uppercase">
              {group.name}
              <span className="rounded-full bg-ui-panel2 px-1.5 py-0.5 text-[9px]">{group.editions.length}</span>
              <div className="h-px flex-1 bg-ui-border" />
            </div>
            <div className="space-y-2">
              {group.editions.map((edition) => {
                const artifact = getArtifact(edition)
                const firstCard = artifact?.cards[0]
                const template = firstCard ? getTemplateById(firstCard.templateId) : undefined
                const active = activeEditionId === edition.id
                return (
                  <article
                    key={edition.id}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-ui-panel2 transition-colors',
                      active ? 'border-brand-red ring-1 ring-brand-red/25' : 'border-ui-border hover:border-ui-muted',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openEdition(edition)}
                      className="flex w-full gap-2.5 p-2 text-left"
                      aria-label={`Abrir edição ${edition.name}`}
                    >
                      <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-ui-border bg-white">
                        {template && firstCard ? (
                          <TemplateThumb template={template} elements={firstCard.elements} dark={firstCard.darkMode} />
                        ) : (
                          <div className="grid size-full place-items-center text-ui-muted"><Shapes className="size-5" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-start gap-1.5">
                          <span className="line-clamp-2 flex-1 text-[11px] leading-snug font-semibold text-ui-text">{edition.name}</span>
                          {active && <span className="mt-0.5 size-2 shrink-0 rounded-full bg-brand-red" title="Em edição" />}
                        </div>
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-ui-border px-1.5 py-0.5 text-[9px] text-ui-muted">
                          {artifact?.kind === 'carousel' ? <Layers3 className="size-2.5" /> : <Shapes className="size-2.5" />}
                          {getTypeLabel(artifact?.kind)}
                          {artifact?.kind === 'carousel' && ` · ${artifact.cards.length} cards`}
                        </span>
                        <span className="mt-2 flex items-center gap-1 text-[9px] text-ui-muted">
                          <Clock3 className="size-2.5" /> {new Date(edition.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

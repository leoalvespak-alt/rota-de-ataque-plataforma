import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, FolderOpen, Layers3, Plus, Shapes } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectDocument } from '@/domain/documents'
import { ProjectRepository } from '@/domain/repositories'
import { HeaderPrimaryButton, HeaderSecondaryButton } from '@/app/HeaderButtons'
import { useProjectSessionStore } from '@/stores/useProjectSessionStore'
import { useTemplateLibraryStore } from '@/stores/useTemplateLibraryStore'
import { useUiStore } from '@/stores/useUiStore'
import { ensureEditorialSeedEditions } from './editorialSeed'

function getArtifact(project: ProjectDocument) {
  return project.campaigns[0]?.artifacts[0]
}

/** Lista as edições locais; os modelos permanecem somente no catálogo. */
export function EditionsView() {
  const repository = useMemo(() => new ProjectRepository(), [])
  const [editions, setEditions] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const activeEditionId = useProjectSessionStore((state) => state.project?.id)
  const setProject = useProjectSessionStore((state) => state.setProject)
  const setTab = useUiStore((state) => state.setTab)
  const openLibrary = useTemplateLibraryStore((state) => state.openLibrary)

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

  const handleOpen = (edition: ProjectDocument) => {
    setProject(edition)
    setTab('create')
    toast.success('Edição aberta.')
  }

  const handleNew = () => {
    setTab('create')
    openLibrary()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-ui-bg p-5 text-ui-text lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-red">
              <Shapes className="size-5" />
              <span className="text-xs font-semibold tracking-[0.12em] uppercase">Seu espaço de trabalho</span>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-wide uppercase lg:text-3xl">
              Edições
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ui-muted">
              Cada edição é uma cópia independente de um modelo. Alterar textos, imagens ou a ordem do carrossel nunca modifica a biblioteca.
            </p>
          </div>
          <HeaderPrimaryButton onClick={handleNew}>
            <Plus className="size-4" /> Escolher modelo
          </HeaderPrimaryButton>
        </div>

        {loading ? (
          <p className="text-sm text-ui-muted">Carregando edições...</p>
        ) : editions.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-ui-border bg-ui-panel px-6 text-center">
            <FolderOpen className="mb-3 size-10 text-ui-muted" />
            <h2 className="font-heading text-lg font-bold uppercase">Nenhuma edição ainda</h2>
            <p className="mt-2 max-w-md text-sm text-ui-muted">
              Escolha um modelo para criar sua primeira edição local. Ela será salva automaticamente enquanto você trabalha.
            </p>
            <HeaderPrimaryButton className="mt-5" onClick={handleNew}>
              <Plus className="size-4" /> Criar edição
            </HeaderPrimaryButton>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {editions.map((edition) => {
              const artifact = getArtifact(edition)
              const isCarousel = artifact?.kind === 'carousel'
              return (
                <article
                  key={edition.id}
                  className="rounded-xl border border-ui-border bg-ui-panel p-4 shadow-sm transition-colors hover:border-ui-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-ui-text">{edition.name}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ui-muted">
                        {isCarousel ? <Layers3 className="size-3.5" /> : <Shapes className="size-3.5" />}
                        {isCarousel ? `${artifact?.cards.length ?? 0} cards no carrossel` : 'Post ou story'}
                      </p>
                    </div>
                    {activeEditionId === edition.id && (
                      <span className="rounded-full bg-brand-red/15 px-2 py-1 text-[10px] font-semibold text-brand-red uppercase">
                        Em edição
                      </span>
                    )}
                  </div>
                  <p className="mt-5 flex items-center gap-1.5 text-xs text-ui-muted">
                    <Clock3 className="size-3.5" /> Atualizada {new Date(edition.updatedAt).toLocaleString('pt-BR')}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <HeaderPrimaryButton className="flex-1 justify-center text-xs" onClick={() => handleOpen(edition)}>
                      Abrir edição
                    </HeaderPrimaryButton>
                    <HeaderSecondaryButton className="text-xs" onClick={() => void refresh()} title="Atualizar lista">
                      Atualizar
                    </HeaderSecondaryButton>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

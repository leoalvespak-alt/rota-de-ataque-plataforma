import { Check, LoaderCircle, Pencil, TriangleAlert } from 'lucide-react'
import { ProjectRepository } from '@/domain/repositories'
import { useProjectSessionStore } from '@/stores/useProjectSessionStore'

/** Identifica a edição atual; a navegação entre edições fica na galeria lateral. */
export function ProjectSessionControls() {
  const project = useProjectSessionStore((state) => state.project)
  const status = useProjectSessionStore((state) => state.status)
  const error = useProjectSessionStore((state) => state.error)
  const setProject = useProjectSessionStore((state) => state.setProject)
  const setStatus = useProjectSessionStore((state) => state.setStatus)

  const rename = async () => {
    if (!project) return
    const name = window.prompt('Nome da edição', project.name)?.trim()
    if (!name || name === project.name) return
    const next = { ...project, name, updatedAt: Date.now() }
    try {
      await new ProjectRepository().save(next)
      setProject(next)
    } catch (reason) {
      setStatus('error', reason instanceof Error ? reason.message : 'Não foi possível renomear a edição.')
    }
  }

  return (
    <div className="hidden min-w-0 items-center gap-1 lg:flex">
      <div
        className="flex max-w-52 min-w-0 items-center rounded border border-ui-border bg-ui-panel2 px-2 py-1 text-xs text-ui-text"
        title={project?.name ?? 'Edição não salva'}
      >
        <span className="truncate">{project?.name ?? 'Edição não salva'}</span>
      </div>
      <button
        type="button"
        title="Renomear edição"
        aria-label="Renomear edição"
        disabled={!project}
        onClick={() => void rename()}
        className="rounded p-1 text-ui-muted hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pencil className="size-3.5" />
      </button>
      {status === 'saving' && <LoaderCircle aria-label="Salvando" className="size-3.5 animate-spin text-ui-muted" />}
      {status === 'ready' && <Check aria-label="Salvo localmente" className="size-3.5 text-emerald-500" />}
      {status === 'error' && (
        <span title={error ?? undefined}>
          <TriangleAlert aria-label={error ?? 'Erro de persistência'} className="size-3.5 text-brand-red" />
        </span>
      )}
    </div>
  )
}

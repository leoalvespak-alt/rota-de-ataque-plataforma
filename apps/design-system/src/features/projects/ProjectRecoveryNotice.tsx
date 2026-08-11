import { loadProjectIntoLegacyStores } from '@/domain/adapters'
import { useProjectSessionStore } from '@/stores/useProjectSessionStore'

export function ProjectRecoveryNotice() {
  const project = useProjectSessionStore((state) => state.recoveryProject)
  const setProject = useProjectSessionStore((state) => state.setProject)
  const clearRecovery = useProjectSessionStore((state) => state.clearRecovery)
  if (!project) return null
  return (
    <div className="fixed right-4 bottom-4 z-[90] w-80 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-2xl">
      <p className="font-heading text-sm text-ui-text">Projeto recuperável</p>
      <p className="mt-1 text-xs text-ui-muted">Encontramos uma versão local salva de “{project.name}”.</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded bg-brand-red px-3 py-1.5 text-xs font-semibold text-white" onClick={() => { if (loadProjectIntoLegacyStores(project)) setProject(project); clearRecovery() }}>Restaurar</button>
        <button className="rounded border border-ui-border px-3 py-1.5 text-xs text-ui-text" onClick={clearRecovery}>Descartar</button>
      </div>
    </div>
  )
}

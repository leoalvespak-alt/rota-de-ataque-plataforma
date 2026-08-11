import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { AutosaveService, registerVisibilityFlush } from '@/domain/autosave'
import { editorToCard, loadProjectIntoLegacyStores, slideToCard } from '@/domain/adapters'
import { type ProjectDocument } from '@/domain/documents'
import { ProjectRepository } from '@/domain/repositories'
import { useDecorStore } from '@/stores/useDecorStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useProjectSessionStore } from '@/stores/useProjectSessionStore'
import { useSeriesStore } from '@/stores/useSeriesStore'
import { ProjectRecoveryNotice } from './ProjectRecoveryNotice'
import { ensureEditorialSeedEditions } from '@/features/editions/editorialSeed'

function updateDocument(project: ProjectDocument): ProjectDocument | undefined {
  const editor = useEditorStore.getState()
  const decor = useDecorStore.getState()
  const card = editorToCard(editor, decor)
  const campaign = project.campaigns[0]
  const artifact = campaign?.artifacts[0]
  if (!card || !campaign || !artifact) return undefined
  const series = useSeriesStore.getState().slides
  const cards = series.length > 0 ? series.map(slideToCard) : [card]
  return { ...project, updatedAt: Date.now(), campaigns: [{ ...campaign, artifacts: [{ ...artifact, kind: cards.length > 1 ? 'carousel' : editor.format === 'portrait' ? 'story' : 'post', cards }] }] }
}

/** Bridge opt-in: mantém a UI existente como fonte de edição e persiste um documento versionado. */
export function ProjectSessionProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => new ProjectRepository(), [])
  const autosave = useMemo(() => new AutosaveService(repository), [repository])
  const projectRef = useRef<ProjectDocument | undefined>(undefined)
  const setProject = useProjectSessionStore((state) => state.setProject)
  const setStatus = useProjectSessionStore((state) => state.setStatus)

  useEffect(() => {
    let active = true
    setStatus('loading')
    void ensureEditorialSeedEditions(repository).then(() => repository.list()).then((projects) => {
      if (!active) return
      const latest = projects.sort((a, b) => b.updatedAt - a.updatedAt)[0]
      const project = latest
      if (!project) { setStatus('idle'); return }
      projectRef.current = project
      loadProjectIntoLegacyStores(project)
      setProject(project)
      autosave.schedule(project)
    }).catch((error: unknown) => setStatus('error', error instanceof Error ? error.message : 'Não foi possível abrir o projeto.'))

    const persist = () => {
      if (!projectRef.current) return
      const next = updateDocument(projectRef.current)
      if (!next) return
      projectRef.current = next
      setProject(next)
      autosave.schedule(next)
      setStatus('saving')
    }
    const unsubs = [useEditorStore.subscribe(persist), useDecorStore.subscribe(persist), useSeriesStore.subscribe(persist)]
    // A project selected by the project switcher becomes the source for subsequent autosaves.
    const unsubscribeSession = useProjectSessionStore.subscribe((state, previous) => {
      if (state.project?.id && state.project.id !== previous.project?.id && state.project.id !== projectRef.current?.id) {
        projectRef.current = state.project
        loadProjectIntoLegacyStores(state.project)
        autosave.schedule(state.project)
      }
    })
    const unregisterVisibility = registerVisibilityFlush(autosave)
    return () => { active = false; unsubs.forEach((unsubscribe) => unsubscribe()); unsubscribeSession(); unregisterVisibility(); autosave.dispose() }
  }, [autosave, repository, setProject, setStatus])

  return <>{children}<ProjectRecoveryNotice /></>
}

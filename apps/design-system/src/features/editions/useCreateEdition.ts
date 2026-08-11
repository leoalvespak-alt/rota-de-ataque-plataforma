import { toast } from 'sonner'
import { ProjectRepository } from '@/domain/repositories'
import { useDecorStore } from '@/stores/useDecorStore'
import { useProjectSessionStore } from '@/stores/useProjectSessionStore'
import { createEditionFromTemplates } from './editionFactory'

const repository = new ProjectRepository()

/** Persiste a nova edição antes de carregá-la no editor. */
export function useCreateEdition() {
  const setProject = useProjectSessionStore((state) => state.setProject)

  return async (templateIds: string[]) => {
    try {
      const project = createEditionFromTemplates(templateIds, useDecorStore.getState())
      await repository.save(project)
      setProject(project)
      toast.success(
        templateIds.length > 1
          ? 'Carrossel criado como uma nova edição.'
          : 'Modelo copiado para uma nova edição.',
      )
      return project
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a edição.')
      return undefined
    }
  }
}

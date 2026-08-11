import { ProjectRepository, type SnapshotRepository } from './repositories'
import type { ProjectDocument } from './documents'

export interface AutosaveStatus { state: 'idle' | 'saving' | 'saved' | 'error'; lastSavedAt?: number; error?: string }

/** Debounced save with a final best-effort flush for tab changes and page hiding. */
export class AutosaveService {
  private timeout?: ReturnType<typeof setTimeout>
  private pending?: ProjectDocument
  private status: AutosaveStatus = { state: 'idle' }
  private readonly projects: ProjectRepository
  private readonly debounceMs: number

  constructor(projects = new ProjectRepository(), debounceMs = 600) {
    this.projects = projects
    this.debounceMs = debounceMs
  }

  schedule(project: ProjectDocument): void {
    this.pending = structuredClone(project)
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = setTimeout(() => { void this.flush() }, this.debounceMs)
  }

  async flush(): Promise<AutosaveStatus> {
    if (!this.pending) return this.status
    const project = this.pending
    this.pending = undefined
    this.status = { state: 'saving' }
    try {
      await this.projects.save(project)
      this.status = { state: 'saved', lastSavedAt: Date.now() }
    } catch (error) {
      this.pending = project
      this.status = { state: 'error', error: error instanceof Error ? error.message : 'Não foi possível salvar.' }
    }
    return this.status
  }

  getStatus(): AutosaveStatus { return this.status }
  dispose(): void { if (this.timeout) clearTimeout(this.timeout); void this.flush() }
}

export function registerVisibilityFlush(service: AutosaveService): () => void {
  const onVisibilityChange = () => { if (document.visibilityState === 'hidden') void service.flush() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}

export async function createSnapshot<T>(repository: SnapshotRepository<T>, projectId: string, label: string, value: T): Promise<void> {
  await repository.save({ id: crypto.randomUUID(), projectId, label, createdAt: Date.now(), value: structuredClone(value) })
}

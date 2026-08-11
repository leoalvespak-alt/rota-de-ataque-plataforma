import { del, get, keys, set } from 'idb-keyval'
import { migrateProject } from './migrations'
import type { ProjectDocument } from './documents'

const PREFIX = 'rda-project:'
const BACKUP_PREFIX = 'rda-project-backup:'

export class ProjectRepository {
  async save(project: ProjectDocument): Promise<void> {
    await set(`${PREFIX}${project.id}`, { ...project, updatedAt: Date.now() })
  }

  async load(id: string): Promise<ProjectDocument | undefined> {
    const raw = await get<unknown>(`${PREFIX}${id}`)
    if (!raw) return undefined
    const result = migrateProject(raw)
    if (result.migrated) {
      await set(`${BACKUP_PREFIX}${id}:${Date.now()}`, result.backup)
      await this.save(result.project)
    }
    return result.project
  }

  async list(): Promise<ProjectDocument[]> {
    const allKeys = await keys()
    const projectKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith(PREFIX))
    return (await Promise.all(projectKeys.map((key) => this.load(key.slice(PREFIX.length))))).filter((item): item is ProjectDocument => Boolean(item))
  }

  async remove(id: string): Promise<void> { await del(`${PREFIX}${id}`) }
}

export interface Snapshot<T> { id: string; projectId: string; label: string; createdAt: number; value: T }

export class SnapshotRepository<T> {
  async save(snapshot: Snapshot<T>): Promise<void> { await set(`rda-snapshot:${snapshot.projectId}:${snapshot.id}`, snapshot) }
  async list(projectId: string): Promise<Snapshot<T>[]> {
    const allKeys = await keys()
    const prefix = `rda-snapshot:${projectId}:`
    const snapshotKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith(prefix))
    const snapshots = await Promise.all(snapshotKeys.map((key) => get<Snapshot<T>>(key)))
    return snapshots.filter((item): item is Snapshot<T> => Boolean(item)).sort((a, b) => b.createdAt - a.createdAt)
  }
}

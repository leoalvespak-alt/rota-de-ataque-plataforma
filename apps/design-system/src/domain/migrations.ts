import { SCHEMA_VERSION, type ProjectDocument, projectDocumentSchema } from './documents'

export interface MigrationResult {
  project: ProjectDocument
  migrated: boolean
  backup: unknown
}

/** Migrações puras e idempotentes: o original sempre é preservado para recuperação. */
export function migrateProject(input: unknown): MigrationResult {
  const backup = structuredClone(input)
  const candidate = input as Partial<ProjectDocument>
  if (candidate.schemaVersion === SCHEMA_VERSION) {
    return { project: projectDocumentSchema.parse(candidate), migrated: false, backup }
  }
  if (!candidate.schemaVersion || candidate.schemaVersion < 1) {
    const migrated = { ...candidate, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() }
    return { project: projectDocumentSchema.parse(migrated), migrated: true, backup }
  }
  throw new Error(`Versão de documento ${candidate.schemaVersion} não é suportada.`)
}

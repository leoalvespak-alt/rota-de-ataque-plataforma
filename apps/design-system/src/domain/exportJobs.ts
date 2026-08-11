import { z } from 'zod'

export const exportProfileSchema = z.object({
  id: z.string(), name: z.string().min(1), scale: z.number().positive(), quality: z.number().min(0).max(1),
  filePattern: z.string().min(1), zipFolder: z.string().optional(), order: z.enum(['artwork', 'created']),
})
export type ExportProfile = z.infer<typeof exportProfileSchema>
export type ExportJobState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'needs-attention'
export interface ExportJob { id: string; projectId: string; artifactId: string; profile: ExportProfile; state: ExportJobState; documentVersion: number; createdAt: number; completedAt?: number; errors: { cardId?: string; message: string }[] }

export function sanitizeFilename(value: string): string {
  const cleaned = [...value.normalize('NFKD')].map((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character
  }).join('')
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, 120).normalize('NFC') || 'arte'
}

export function resolveExportName(profile: ExportProfile, tokens: Record<string, string | number>): string {
  const result = profile.filePattern.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, key: string) => String(tokens[key] ?? ''))
  return sanitizeFilename(result)
}

export class ExportQueue {
  private jobs = new Map<string, ExportJob>()
  enqueue(job: Omit<ExportJob, 'id' | 'state' | 'createdAt' | 'errors'>): ExportJob {
    const item: ExportJob = { ...job, id: crypto.randomUUID(), state: 'queued', createdAt: Date.now(), errors: [] }
    this.jobs.set(item.id, item); return item
  }
  transition(id: string, state: ExportJobState, error?: { cardId?: string; message: string }): ExportJob {
    const current = this.jobs.get(id); if (!current) throw new Error('Job não encontrado.')
    const next = { ...current, state, completedAt: ['completed', 'failed', 'cancelled'].includes(state) ? Date.now() : undefined, errors: error ? [...current.errors, error] : current.errors }
    this.jobs.set(id, next); return next
  }
  list(): ExportJob[] { return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt) }
}

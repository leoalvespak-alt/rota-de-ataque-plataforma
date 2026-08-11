import { z } from 'zod'
import { generateCopy } from '@/lib/ai/generateCopy'
import { getTemplateContract } from './templateContracts'
import type { AIModel } from '@/stores/useAIStore'

export const aiCardProposalSchema = z.object({ templateId: z.string(), fields: z.record(z.string(), z.string()) })
export const aiProposalSchema = z.object({ title: z.string(), cards: z.array(aiCardProposalSchema).min(1), notes: z.array(z.string()).default([]) })
export type AIProposal = z.infer<typeof aiProposalSchema>
export interface AIRequest {
  prompt: string
  templateIds: string[]
  model: AIModel
  apiKey: string
  career: 'fiscal' | 'policial' | 'tribunal' | 'geral'
  signal?: AbortSignal
  timeoutMs?: number
}
export interface AIAuditEntry { model: string; promptVersion: string; elapsedMs: number; accepted: boolean; createdAt: number }

/** Encapsula a IA existente; a proposta nunca altera o documento diretamente. */
export class AIOrchestrator {
  async propose(request: AIRequest): Promise<AIProposal> {
    const templates = request.templateIds.map((id) => getTemplateContract(id)).filter(Boolean)
    if (!templates.length) throw new Error('Selecione ao menos um template aprovado.')
    const primary = templates[0]!
    const work = generateCopy({
      model: request.model,
      apiKey: request.apiKey,
      prompt: request.prompt,
      career: request.career,
      availableFields: primary.fieldSchema.fields.filter((field) => field.type === 'text').map((field) => field.name),
    })
    const fields = await withTimeout(work, request.timeoutMs ?? 25_000, request.signal)
    return aiProposalSchema.parse({ title: request.prompt, cards: [{ templateId: primary.templateId, fields }], notes: [] })
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('A solicitação de IA excedeu o tempo limite.')), timeoutMs)
    const abort = () => { clearTimeout(timer); reject(new DOMException('Solicitação cancelada.', 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
    promise.then((value) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); resolve(value) }, (error) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(error) })
  })
}

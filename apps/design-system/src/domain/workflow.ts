import type { WorkflowStatus } from './documents'

const allowed: Record<WorkflowStatus, WorkflowStatus[]> = {
  draft: ['in-review'],
  'in-review': ['changes-requested', 'approved'],
  'changes-requested': ['draft', 'in-review'],
  approved: ['published', 'changes-requested'],
  published: ['changes-requested'],
}

export interface ReviewComment { id: string; cardId: string; revision: number; body: string; author: string; createdAt: number; resolvedAt?: number }
export interface WorkflowEvent { id: string; from: WorkflowStatus; to: WorkflowStatus; author: string; at: number; reason?: string }

export function transitionWorkflow(from: WorkflowStatus, to: WorkflowStatus, author: string, reason?: string): WorkflowEvent {
  if (!allowed[from].includes(to)) throw new Error(`Transição inválida: ${from} → ${to}.`)
  if (from === 'approved' && to === 'changes-requested' && !reason?.trim()) throw new Error('Reabrir uma aprovação exige motivo.')
  return { id: crypto.randomUUID(), from, to, author, at: Date.now(), reason }
}

export function createReviewComment(cardId: string, revision: number, body: string, author = 'Usuário local'): ReviewComment {
  if (!body.trim()) throw new Error('O comentário não pode ficar vazio.')
  return { id: crypto.randomUUID(), cardId, revision, body: body.trim(), author, createdAt: Date.now() }
}

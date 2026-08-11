import { z } from 'zod'
import type { CardDocument, DataBinding } from './documents'

export const reusableDataSchema = z.object({
  id: z.string(), kind: z.enum(['concurso', 'banca', 'cargo', 'salario', 'disciplina', 'data', 'custom']),
  name: z.string().min(1), fields: z.record(z.string(), z.string()), tags: z.array(z.string()), source: z.string().optional(),
  verifiedAt: z.number().optional(), updatedAt: z.number(),
})
export type ReusableDataRecord = z.infer<typeof reusableDataSchema>

export function bindField(card: CardDocument, binding: DataBinding, materializedValue: unknown): CardDocument {
  const next = structuredClone(card)
  const bindings = next.bindings?.filter((item) => item.fieldPath !== binding.fieldPath) ?? []
  bindings.push(binding)
  next.bindings = bindings
  next.elements[binding.fieldPath] = materializedValue
  return next
}

export function freezeBinding(card: CardDocument, fieldPath: string): CardDocument {
  const next = structuredClone(card)
  next.bindings = next.bindings?.map((binding) => binding.fieldPath === fieldPath ? { ...binding, frozen: true } : binding)
  return next
}

export function impactedCards(cards: CardDocument[], sourceId: string): CardDocument[] {
  return cards.filter((card) => card.bindings?.some((binding) => binding.sourceId === sourceId && !binding.frozen))
}

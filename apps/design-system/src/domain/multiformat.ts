import type { CardDocument } from './documents'
import { stableId } from './documents'
import { getEquivalentTemplate, getTemplateContract } from './templateContracts'
import { validateCards } from './validation'

export interface ConversionPreview { sourceId: string; target?: CardDocument; warnings: string[]; valid: boolean }

export function previewConversion(card: CardDocument, format: 'square' | 'portrait'): ConversionPreview {
  const targetId = getEquivalentTemplate(card.templateId, format)
  if (!targetId) return { sourceId: card.id, warnings: ['Não há equivalência aprovada para este formato.'], valid: false }
  const targetContract = getTemplateContract(targetId)
  if (!targetContract) return { sourceId: card.id, warnings: ['Contrato do template de destino indisponível.'], valid: false }
  const fields = new Set(targetContract.fieldSchema.fields.map((field) => field.name))
  const elements = Object.fromEntries(Object.entries(card.elements).filter(([key]) => fields.has(key)))
  const dropped = Object.keys(card.elements).filter((key) => !fields.has(key))
  const target: CardDocument = { ...structuredClone(card), id: stableId('card'), templateId: targetId, elements }
  const validation = validateCards([target])
  return { sourceId: card.id, target, warnings: dropped.length ? [`Campos sem destino: ${dropped.join(', ')}.`] : [], valid: validation.valid }
}

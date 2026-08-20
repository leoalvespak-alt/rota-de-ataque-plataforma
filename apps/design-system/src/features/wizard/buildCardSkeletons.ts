import { getTemplateContract } from '@/domain/templateContracts'
import { getPresetById } from '@/features/templates/carouselPresets'
import type { CreativeType, ScriptCard } from '@/stores/useWizardStore'

type IdFactory = () => string

function createCard(
  templateId: string,
  role: ScriptCard['role'],
  idFactory: IdFactory,
): ScriptCard {
  const textFields = getTemplateContract(templateId)?.fieldSchema.fields
    .filter((field) => field.type === 'text')
    .map((field) => field.name) ?? ['title', 'body', 'eyebrow']
  const fields = Object.fromEntries(textFields.map((field) => [field, '']))

  return {
    id: idFactory(),
    role,
    templateId,
    fields,
    title: fields.title ?? '',
    body: fields.body ?? fields.subtitle ?? fields.text ?? '',
    eyebrow: fields.eyebrow,
  }
}

/** Pure domain function. Pass an id factory in tests for deterministic output. */
export function buildCardSkeletons(
  templateId: string | null,
  cardCount: number,
  presetId: string | null,
  creativeType: CreativeType,
  idFactory: IdFactory = () => crypto.randomUUID(),
): ScriptCard[] {
  if (!templateId && !presetId) return []

  if (creativeType === 'carousel' && presetId) {
    const preset = getPresetById(presetId)
    if (preset) {
      return preset.slots.map((slot) => createCard(slot.templateId, slot.role, idFactory))
    }
  }

  const resolvedTemplateId = templateId
  if (!resolvedTemplateId) return []
  if (creativeType !== 'carousel') return [createCard(resolvedTemplateId, 'cover', idFactory)]

  const total = Math.max(1, Math.min(10, Math.trunc(cardCount)))
  return Array.from({ length: total }, (_, index) =>
    createCard(
      resolvedTemplateId,
      index === 0 ? 'cover' : index === total - 1 ? 'cta' : 'slide',
      idFactory,
    ),
  )
}

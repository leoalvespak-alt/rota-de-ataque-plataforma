import { z } from 'zod'
import { getTemplateContract } from '@/domain/templateContracts'
import type { ScriptCard } from '@/stores/useWizardStore'

/**
 * Cria um schema Zod para validar a resposta de IA com base no contrato do template.
 * @param templateId - ID do template ou template da slide.
 * @param fields - Campos esperados (opcional, usa contrato se não fornecido).
 */
export function createCopySchema(templateId: string, fields?: string[]) {
  const contract = getTemplateContract(templateId)
  if (!contract) {
    return z.record(z.string(), z.string())
  }

  const schemaFields: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {}
  const contractFields = fields ?? contract.fieldSchema.fields.filter(f => f.type === 'text').map(f => f.name)

  for (const fieldName of contractFields) {
    const fieldDef = contract.fieldSchema.fields.find(f => f.name === fieldName)
    if (!fieldDef) continue

    let fieldSchema = z.string()
    if (fieldDef.required) {
      fieldSchema = fieldSchema.min(1, { message: `Campo obrigatório: ${fieldName}` })
    }
    if (fieldDef.maxLength) {
      fieldSchema = fieldSchema.max(fieldDef.maxLength, { message: `Máximo de ${fieldDef.maxLength} caracteres: ${fieldName}` })
    }
    schemaFields[fieldName] = fieldDef.required ? fieldSchema : fieldSchema.optional()
  }

  return z.object(schemaFields).strict()
}

/**
 * Valida uma resposta de IA contra o schema do template.
 * @returns Objeto com campos válidos + erros de validação.
 */
export function validateCopyResponse(
  templateId: string,
  response: unknown,
  fields?: string[],
): { validData: Record<string, string>; errors: { field: string; message: string }[] } {
  const schema = createCopySchema(templateId, fields)
  const result = schema.safeParse(response)

  if (result.success) {
    const validData = Object.fromEntries(
      Object.entries(result.data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
    return { validData, errors: [] }
  }

  const errors = result.error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }))

  // Extrai dados válidos mesmo em caso de erro parcial
  const validData: Record<string, string> = {}
  if (typeof response === 'object' && response) {
    for (const [key, value] of Object.entries(response)) {
      if (typeof value === 'string' && !errors.some(e => e.field === key)) {
        validData[key] = value
      }
    }
  }

  return { validData, errors }
}

/**
 * Mapeia campos customizados (ex: `subtitle`, `cta`) para os campos do card (`title`, `body`, `eyebrow`).
 */
export function mapCustomFieldsToCard(
  templateId: string,
  data: Record<string, string>,
): Partial<ScriptCard> {
  const contract = getTemplateContract(templateId)
  if (!contract) return {}

  const card: Partial<ScriptCard> = {}
  for (const [fieldName, value] of Object.entries(data)) {
    const fieldDef = contract.fieldSchema.fields.find(f => f.name === fieldName)
    if (!fieldDef) continue

    switch (fieldDef.semantic) {
      case 'title':
        card.title = value
        break
      case 'subtitle':
        card.body = value // Subtítulo vira corpo ou é concatenado
        break
      case 'body':
        card.body = value
        break
      case 'eyebrow':
        card.eyebrow = value
        break
      case 'cta':
        card.body = card.body ? `${card.body}\n\n${value}` : value
        break
      case 'highlight':
        card.body = card.body ? `${card.body}\n\n${value}` : value
        break
      case 'caption':
        card.eyebrow = value
        break
      default:
        // Campos desconhecidos são ignorados ou mapeados para `body`
        card.body = card.body ? `${card.body}\n\n${value}` : value
    }
  }

  return card
}

import type { CardDocument } from './documents'
import type { ValidationResult } from './mutations'
import type { ValidationIssue } from './mutations'
import { getTemplateContract } from './templateContracts'

export function validateCards(cards: CardDocument[]): ValidationResult {
  const issues: ValidationIssue[] = []
  for (const card of cards) {
    const contract = getTemplateContract(card.templateId)
    if (!contract) {
      issues.push({ code: 'template-missing', message: `Template ${card.templateId} não existe.`, severity: 'error', cardId: card.id })
      continue
    }
    for (const rule of contract.qualityRules) {
      const value = rule.field ? card.elements[rule.field] : undefined
      if (rule.check === 'required' && (value === undefined || value === null || value === '' || value === false)) {
        issues.push({ code: rule.id, message: `O campo ${rule.field} é obrigatório.`, severity: rule.severity, cardId: card.id, field: rule.field })
      }
      if (rule.check === 'max-length' && typeof value === 'string' && value.length > Number(rule.params.maxLength)) {
        issues.push({ code: rule.id, message: `O campo ${rule.field} excede ${rule.params.maxLength} caracteres.`, severity: rule.severity, cardId: card.id, field: rule.field })
      }
    }
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues }
}

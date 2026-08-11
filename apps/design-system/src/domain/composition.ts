import type { CardDocument } from './documents'
import { getTemplateContract } from './templateContracts'

export type CompositionCondition = { kind: 'empty' | 'length' | 'itemCount' | 'hasImage' | 'format'; field?: string; operator?: 'eq' | 'gt' | 'lt'; value?: string | number | boolean }
export type CompositionAction = { kind: 'hide-field' | 'choose-variant' | 'limit-items' | 'adjust-style'; field?: string; value: string | number }
export interface CompositionRule { id: string; priority: number; when: CompositionCondition; then: CompositionAction }
export interface CompositionEffect { ruleId: string; message: string; card: CardDocument }

function matches(card: CardDocument, condition: CompositionCondition): boolean {
  const value = condition.field ? card.elements[condition.field] : undefined
  if (condition.kind === 'empty') return value === '' || value === false || value === null || value === undefined
  if (condition.kind === 'length') return typeof value === 'string' && compare(value.length, condition.operator, Number(condition.value))
  if (condition.kind === 'itemCount') return Array.isArray(value) && compare(value.length, condition.operator, Number(condition.value))
  if (condition.kind === 'hasImage') return Boolean(value) === Boolean(condition.value)
  return condition.kind === 'format' && card.templateId.startsWith(String(condition.value))
}
function compare(left: number, operator: CompositionCondition['operator'], right: number): boolean { return operator === 'gt' ? left > right : operator === 'lt' ? left < right : left === right }

/** Limited DSL: pure data only, no arbitrary JavaScript. */
export function applyCompositionRules(card: CardDocument, rules: CompositionRule[]): CompositionEffect[] {
  const effects: CompositionEffect[] = []
  for (const rule of [...rules].sort((a, b) => a.priority - b.priority)) {
    if (!matches(card, rule.when)) continue
    const next = structuredClone(card)
    if (rule.then.kind === 'hide-field' && rule.then.field) next.elements[rule.then.field] = false
    if (rule.then.kind === 'choose-variant') {
      const contract = getTemplateContract(card.templateId)
      if (!contract?.variants.some((variant) => variant.id === rule.then.value)) continue
      next.variantId = String(rule.then.value)
    }
    if (rule.then.kind === 'limit-items' && rule.then.field) {
      const list = next.elements[rule.then.field]
      if (Array.isArray(list)) next.elements[rule.then.field] = list.slice(0, Number(rule.then.value))
    }
    effects.push({ ruleId: rule.id, message: `Regra ${rule.id} aplicada.`, card: next })
  }
  return effects
}

export function smartLayout(card: CardDocument): { range: 'short' | 'medium' | 'long'; adjustments: Record<string, string | number> } {
  const contract = getTemplateContract(card.templateId)
  const textLength = Object.values(card.elements).filter((value): value is string => typeof value === 'string').join('').length
  const range = textLength > 320 ? 'long' : textLength > 130 ? 'medium' : 'short'
  const rule = contract?.layoutRules.find((item) => item.contentRange === range)
  return { range, adjustments: Object.fromEntries(rule?.adjustments.map((item) => [item.property, item.value]) ?? []) }
}

import type { ApplyScope, CardDocument } from './documents'

export type IssueSeverity = 'error' | 'warning' | 'info'
export interface ValidationIssue { code: string; message: string; severity: IssueSeverity; cardId?: string; field?: string }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[] }
export interface FieldChange { path: string; before: unknown; after: unknown }
export interface CardChange { cardId: string; changes: FieldChange[] }
export interface ChangeSet { id: string; label: string; scope: ApplyScope; cards: CardChange[]; createdAt: number }
export interface ChangePreview { changeSet: ChangeSet; validation: ValidationResult; affectedCards: number }
export interface MutationReceipt { changeSet: ChangeSet; appliedAt: number; undo: () => CardDocument[] }

export interface MutationCommand {
  id: string
  label: string
  scope: ApplyScope
  apply(card: CardDocument): CardDocument
}

const getAtPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, part) => {
  if (current && typeof current === 'object') return (current as Record<string, unknown>)[part]
  return undefined
}, value)

function diff(before: Record<string, unknown>, after: Record<string, unknown>, prefix = ''): FieldChange[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].flatMap((name) => {
    const path = prefix ? `${prefix}.${name}` : name
    const left = before[name]
    const right = after[name]
    if (Object.is(left, right)) return []
    if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
      return diff(left as Record<string, unknown>, right as Record<string, unknown>, path)
    }
    return [{ path, before: left, after: right }]
  })
}

export class MutationService {
  private history: ChangeSet[] = []

  preview(command: MutationCommand, cards: CardDocument[], validate: (cards: CardDocument[]) => ValidationResult): ChangePreview {
    const proposed = cards.map((card) => command.apply(structuredClone(card)))
    const changes = cards.map((card, index) => ({ cardId: card.id, changes: diff(card.elements, proposed[index]!.elements) })).filter((entry) => entry.changes.length > 0)
    const changeSet: ChangeSet = { id: crypto.randomUUID(), label: command.label, scope: command.scope, cards: changes, createdAt: Date.now() }
    return { changeSet, validation: validate(proposed), affectedCards: changes.length }
  }

  apply(command: MutationCommand, cards: CardDocument[], validate: (cards: CardDocument[]) => ValidationResult): { cards: CardDocument[]; receipt: MutationReceipt } {
    const preview = this.preview(command, cards, validate)
    if (!preview.validation.valid) throw new Error(preview.validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '))
    const before = structuredClone(cards)
    const next = cards.map((card) => command.apply(structuredClone(card)))
    this.history.push(preview.changeSet)
    return {
      cards: next,
      receipt: { changeSet: preview.changeSet, appliedAt: Date.now(), undo: () => structuredClone(before) },
    }
  }

  latest(): ChangeSet | undefined { return this.history.at(-1) }
  clear(): void { this.history = [] }
}

/** Comando seguro para substituir somente um campo de elements. */
export function setElementCommand(path: string, value: unknown, scope: ApplyScope, label = 'Atualizar conteúdo'): MutationCommand {
  return {
    id: `set:${path}`,
    label,
    scope,
    apply(card) {
      const next = structuredClone(card)
      const parts = path.split('.')
      let target = next.elements
      for (const part of parts.slice(0, -1)) {
        const current = getAtPath(target, part)
        if (!current || typeof current !== 'object') target[part] = {}
        target = target[part] as Record<string, unknown>
      }
      target[parts.at(-1)!] = value
      return next
    },
  }
}

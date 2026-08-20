import type { ScriptCard } from '@/stores/useWizardStore'

export interface ParsedCard {
  role: 'cover' | 'slide' | 'cta'
  eyebrow: string
  title: string
  body: string
}

export class MarkdownParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarkdownParseError'
  }
}

function extractField(text: string, field: string): string {
  const regex = new RegExp(`\\*\\*${field}\\*\\*:\\s*(.*)`, 'i')
  const match = regex.exec(text)
  return match ? match[1]!.trim() : ''
}

function isUnfilled(value: string): boolean {
  return /^\[.*\]$/.test(value.trim())
}

export function parseMarkdownScript(content: string): ParsedCard[] {
  const sections = content.split(/^---$/m).map((s) => s.trim()).filter(Boolean)

  const cards: ParsedCard[] = []

  for (const section of sections) {
    const headingMatch = /^##\s+(.+)$/m.exec(section)
    if (!headingMatch) continue

    const heading = headingMatch[1]!.trim().toUpperCase()
    let role: ParsedCard['role'] | null = null

    if (heading === 'CAPA') {
      role = 'cover'
    } else if (heading === 'CTA') {
      role = 'cta'
    } else if (/^SLIDE\s+\d+$/.test(heading)) {
      role = 'slide'
    }

    if (!role) continue

    const eyebrow = extractField(section, 'eyebrow')
    const title = extractField(section, 'title')
    const body = extractField(section, 'body')

    cards.push({ role, eyebrow, title, body })
  }

  if (cards.length === 0) {
    throw new MarkdownParseError(
      'Formato inválido: nenhuma seção encontrada. Verifique se o arquivo usa o template correto (## CAPA, ## SLIDE N, ## CTA).',
    )
  }

  return cards
}

export function validateParsedCards(cards: ParsedCard[], expectedCount: number): string[] {
  const warnings: string[] = []

  cards.forEach((card, i) => {
    const label = card.role === 'cover' ? 'CAPA' : card.role === 'cta' ? 'CTA' : `SLIDE ${i}`
    if (!card.title || isUnfilled(card.title)) {
      warnings.push(`${label}: campo "title" não foi preenchido.`)
    }
    if (!card.body || isUnfilled(card.body)) {
      warnings.push(`${label}: campo "body" não foi preenchido.`)
    }
  })

  if (cards.length !== expectedCount) {
    warnings.push(
      `O arquivo tem ${cards.length} card(s) mas o Wizard espera ${expectedCount}. Verifique se baixou o template correto.`,
    )
  }

  return warnings
}

export function parsedCardsToScriptCards(parsed: ParsedCard[]): ScriptCard[] {
  return parsed.map((p) => {
    const title = isUnfilled(p.title) ? '' : p.title
    const body = isUnfilled(p.body) ? '' : p.body
    const eyebrow = isUnfilled(p.eyebrow) ? '' : p.eyebrow
    return {
      id: crypto.randomUUID(),
      role: p.role,
      fields: { title, body, eyebrow },
      title,
      body,
      eyebrow,
    }
  })
}

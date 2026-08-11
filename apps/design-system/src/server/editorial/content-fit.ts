export interface ContentFit { fits: boolean; action: 'none' | 'compact-template' | 'trim-copy' | 'rewrite'; text: string; reason?: string }
export function fitContentToTemplate(text: string, maxLength: number, hasCompactAlternative = false): ContentFit {
  if (text.length <= maxLength) return { fits: true, action: 'none', text }
  if (hasCompactAlternative) return { fits: false, action: 'compact-template', text, reason: 'O texto pede um template mais denso.' }
  const sentenceBoundary = text.lastIndexOf('.', maxLength - 1)
  if (sentenceBoundary > maxLength * .55) return { fits: true, action: 'trim-copy', text: text.slice(0, sentenceBoundary + 1), reason: 'Pontos de apoio excedentes foram removidos.' }
  return { fits: false, action: 'rewrite', text, reason: 'A cópia precisa ser reescrita para caber com legibilidade.' }
}

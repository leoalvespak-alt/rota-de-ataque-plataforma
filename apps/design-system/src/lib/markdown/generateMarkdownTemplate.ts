export interface MarkdownTemplateParams {
  aspectRatio: 'square' | 'portrait'
  cardCount: number
}

export function generateMarkdownTemplate(params: MarkdownTemplateParams): string {
  const { aspectRatio, cardCount } = params
  const formatLabel = aspectRatio === 'portrait' ? 'Retrato 1080×1350' : 'Quadrado 1080×1080'
  const count = Math.max(1, Math.min(10, cardCount))

  const lines: string[] = [
    `# Roteiro para Criativo — Formato: ${formatLabel}`,
    `# Cards: ${count}`,
    '',
    '> INSTRUÇÕES PARA IA EXTERNA: Preencha os campos entre colchetes',
    '> com textos curtos e impactantes. Mantenha a estrutura exata.',
    '> Não remova as linhas de separador (---).',
    '',
    '---',
    '',
    '## CAPA',
    '',
    '**eyebrow**: [TAG CURTA EM MAIÚSCULAS — 1 a 3 palavras]',
    '**title**: [TÍTULO IMPACTANTE — 4 a 8 palavras em maiúsculas]',
    '**body**: [Texto de apoio — 1 a 2 frases diretas]',
  ]

  if (count === 1) {
    return lines.join('\n')
  }

  if (count === 2) {
    lines.push('', '---', '', '## CTA', '')
    lines.push('**eyebrow**: [TAG DE AÇÃO]')
    lines.push('**title**: [CHAMADA PARA AÇÃO]')
    lines.push('**body**: [Instrução final direta]')
    return lines.join('\n')
  }

  const slideCount = count - 2
  for (let i = 1; i <= slideCount; i++) {
    lines.push('', '---', '', `## SLIDE ${i}`, '')
    lines.push(`**eyebrow**: [TAG CURTA — SLIDE ${i}]`)
    lines.push(`**title**: [TÍTULO DO SLIDE ${i}]`)
    lines.push(`**body**: [Conteúdo principal do slide ${i}]`)
  }

  lines.push('', '---', '', '## CTA', '')
  lines.push('**eyebrow**: [TAG DE AÇÃO]')
  lines.push('**title**: [CHAMADA PARA AÇÃO]')
  lines.push('**body**: [Instrução final direta]')

  return lines.join('\n')
}

export function downloadMarkdownTemplate(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

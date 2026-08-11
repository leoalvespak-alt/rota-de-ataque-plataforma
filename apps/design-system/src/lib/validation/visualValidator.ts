export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  message: string
  field?: string
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  canExport: boolean
}

export function validateOverflow(element: HTMLElement): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (element.scrollHeight > element.clientHeight) {
    issues.push({
      id: 'overflow-vertical',
      severity: 'error',
      message: 'Conteudo ultrapassa a area visivel verticalmente',
      suggestion: 'Reduza o texto ou use uma variante compacta',
    })
  }
  if (element.scrollWidth > element.clientWidth) {
    issues.push({
      id: 'overflow-horizontal',
      severity: 'error',
      message: 'Conteudo ultrapassa a area visivel horizontalmente',
      suggestion: 'Reduza o texto ou ajuste o layout',
    })
  }
  return issues
}

export function validateTextLength(
  text: string,
  maxLength: number,
  field: string,
): ValidationIssue[] {
  if (text.length > maxLength) {
    return [
      {
        id: `text-too-long-${field}`,
        severity: 'warning',
        message: `${field}: texto com ${text.length} caracteres (max: ${maxLength})`,
        field,
        suggestion: `Reduza para ${maxLength} caracteres`,
      },
    ]
  }
  return []
}

export function validateMinFontSize(element: HTMLElement, minPx: number = 11): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const textElements = element.querySelectorAll('*')
  textElements.forEach((el) => {
    const style = window.getComputedStyle(el)
    const fontSize = parseFloat(style.fontSize)
    if (fontSize > 0 && fontSize < minPx && el.textContent?.trim()) {
      issues.push({
        id: `font-too-small-${fontSize}`,
        severity: 'warning',
        message: `Fonte ${fontSize}px abaixo do minimo ${minPx}px`,
        suggestion: `Aumente para pelo menos ${minPx}px`,
      })
    }
  })
  return issues
}

export function validateContrast(
  foreground: string,
  background: string,
): ValidationIssue[] {
  const fgLum = relativeLuminance(parseColor(foreground))
  const bgLum = relativeLuminance(parseColor(background))
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05)

  if (ratio < 3) {
    return [
      {
        id: 'low-contrast',
        severity: 'error',
        message: `Contraste ${ratio.toFixed(1)}:1 abaixo do minimo 3:1`,
        suggestion: 'Ajuste as cores para melhorar legibilidade',
      },
    ]
  }
  if (ratio < 4.5) {
    return [
      {
        id: 'medium-contrast',
        severity: 'warning',
        message: `Contraste ${ratio.toFixed(1)}:1 abaixo de 4.5:1 (AA)`,
        suggestion: 'Considere aumentar o contraste para acessibilidade',
      },
    ]
  }
  return []
}

export function validateSafeArea(
  element: HTMLElement,
  safeArea: { top: number; right: number; bottom: number; left: number },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const rect = element.getBoundingClientRect()
  const children = element.querySelectorAll('[data-slot]')

  children.forEach((child) => {
    const childRect = child.getBoundingClientRect()
    const relTop = childRect.top - rect.top
    const relLeft = childRect.left - rect.left
    const relBottom = rect.bottom - childRect.bottom
    const relRight = rect.right - childRect.right

    if (relTop < safeArea.top || relLeft < safeArea.left || relBottom < safeArea.bottom || relRight < safeArea.right) {
      issues.push({
        id: `safe-area-violation-${child.getAttribute('data-slot')}`,
        severity: 'warning',
        message: `Elemento "${child.getAttribute('data-slot')}" fora da safe area`,
        suggestion: 'Ajuste o posicionamento para respeitar as margens de seguranca',
      })
    }
  })

  return issues
}

export function runFullValidation(element: HTMLElement): ValidationResult {
  const issues = [
    ...validateOverflow(element),
    ...validateMinFontSize(element),
  ]

  const hasErrors = issues.some((i) => i.severity === 'error')

  return {
    valid: !hasErrors,
    issues,
    canExport: !hasErrors,
  }
}

function parseColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  )
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!
}

export function adjustTypography(
  text: string,
  containerWidth: number,
  baseFontSize: number,
): { fontSize: number; tracking: number; strategy: string } {
  const charWidth = baseFontSize * 0.55
  const maxCharsPerLine = Math.floor(containerWidth / charWidth)
  const textLength = text.length

  if (textLength <= maxCharsPerLine * 2) {
    return { fontSize: baseFontSize, tracking: 0, strategy: 'normal' }
  }

  if (textLength <= maxCharsPerLine * 3) {
    return { fontSize: baseFontSize, tracking: -0.02, strategy: 'tracking' }
  }

  if (textLength <= maxCharsPerLine * 4) {
    const reduced = Math.max(baseFontSize * 0.85, 11)
    return { fontSize: reduced, tracking: -0.01, strategy: 'reduced' }
  }

  const compact = Math.max(baseFontSize * 0.75, 11)
  return { fontSize: compact, tracking: -0.02, strategy: 'compact' }
}

import { getTemplateContract } from './templateContracts'

export interface BatchRow { row: number; values: Record<string, string> }
export interface BatchIssue { row: number; field?: string; severity: 'error' | 'warning'; message: string }
export interface BatchValidation { valid: BatchRow[]; issues: BatchIssue[] }

/** CSV seguro no cliente: não interpreta fórmulas nem executa conteúdo de células. */
export function parseCsv(text: string, delimiter = ','): BatchRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const parseLine = (line: string) => line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''))
  const headers = parseLine(lines[0]!).map((header) => header.trim())
  return lines.slice(1).map((line, index) => ({ row: index + 2, values: Object.fromEntries(parseLine(line).map((value, column) => [headers[column] ?? `coluna_${column + 1}`, value])) }))
}

export function validateBatchRows(templateId: string, rows: BatchRow[], mapping: Record<string, string>): BatchValidation {
  const contract = getTemplateContract(templateId)
  if (!contract) return { valid: [], issues: [{ row: 0, severity: 'error', message: 'Template não encontrado.' }] }
  const issues: BatchIssue[] = []
  const valid = rows.filter((row) => {
    const rowIssues: BatchIssue[] = []
    for (const field of contract.fieldSchema.fields) {
      const column = mapping[field.name]
      const value = column ? row.values[column] : undefined
      if (field.required && !value?.trim()) rowIssues.push({ row: row.row, field: field.name, severity: 'error', message: `Campo obrigatório sem valor: ${field.name}.` })
      if (field.maxLength && value && value.length > field.maxLength) rowIssues.push({ row: row.row, field: field.name, severity: 'warning', message: `${field.name} excede o limite recomendado.` })
      if (value?.startsWith('=')) rowIssues.push({ row: row.row, field: field.name, severity: 'warning', message: 'Valor começa com fórmula; será tratado como texto.' })
    }
    issues.push(...rowIssues)
    return !rowIssues.some((issue) => issue.severity === 'error')
  })
  return { valid, issues }
}

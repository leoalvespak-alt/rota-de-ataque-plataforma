function qualifiedName(schema: string, table: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(schema) || !/^[a-z_][a-z0-9_]*$/u.test(table)) {
    throw new Error('Nome de schema ou tabela inválido.')
  }
  return `"${schema}"."${table}"`
}

const designSchema = process.env.DESIGN_SCHEMA ?? 'public'
const editorialSchema = process.env.EDITORIAL_SCHEMA ?? 'public'
const thesisTable = process.env.EDITORIAL_THESIS_TABLE ?? 'editorial_theses'

export const designTable = (table: string) => qualifiedName(designSchema, table)
export const editorialTable = (table: string) => qualifiedName(editorialSchema, table)
export const editorialThesesTable = () => qualifiedName(editorialSchema, thesisTable)

export type DocumentType =
  | 'resumo'
  | 'apostila'
  | 'revisao'
  | 'roteiro'
  | 'relatorio'
  | 'guia'
  | 'tecnico'

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'image'
  | 'callout'
  | 'formula'
  | 'code'
  | 'quote'
  | 'divider'
  | 'diagram'
  | 'chart'
  | 'reference'
  | 'exercise'
  | 'answer'

export interface DocumentBlock {
  id: string
  type: BlockType
  content: string
  level?: number
  items?: string[]
  data?: Record<string, unknown>
}

export interface DocumentPage {
  id: string
  blocks: DocumentBlock[]
}

export interface DocumentData {
  id: string
  type: DocumentType
  title: string
  author?: string
  date?: string
  pages: DocumentPage[]
  dark?: boolean
  header?: string
  footer?: string
  showPageNumbers?: boolean
  showToc?: boolean
}

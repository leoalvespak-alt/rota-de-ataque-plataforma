export type SlideType =
  | 'cover'
  | 'section'
  | 'concept'
  | 'comparison'
  | 'timeline'
  | 'process'
  | 'diagram'
  | 'chart'
  | 'quote'
  | 'summary'
  | 'question'
  | 'answer'
  | 'table'
  | 'formula'
  | 'code'
  | 'case-study'
  | 'conclusion'
  | 'cta'

export interface SlideData {
  id: string
  type: SlideType
  title?: string
  subtitle?: string
  content?: string
  items?: string[]
  notes?: string
  dark?: boolean
  variant?: string
  data?: Record<string, unknown>
}

export interface DeckData {
  id: string
  title: string
  author?: string
  date?: string
  slides: SlideData[]
  dark?: boolean
}

export type SlideMode = 'edit' | 'present' | 'overview'

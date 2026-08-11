/**
 * Tipos base do motor de templates.
 * Espelha 1:1 a semântica do Gerador/index.html original:
 * - `format`/`filter` = mesmos valores usados em TEMPLATES no HTML.
 * - `Hideable<T>` = mesma semântica do `!== false` usado no HTML pra ocultar campo.
 */

export type CanvasFormat = 'square' | 'portrait'
export type FormatFilter = 'square' | 'portrait' | 'carousel'
export type CareerTag = 'fiscal' | 'policial' | 'tribunal' | 'motivacao'

/** Um campo hideable é o valor real, ou `false` quando o usuário oculta. */
export type Hideable<T> = T | false

export interface TemplateRenderProps<E> {
  elements: E
  dark: boolean
  /** true quando renderizado dentro do nó de export offscreen (Fase 7). */
  exportMode?: boolean
}

export interface TemplateControlsProps<E> {
  elements: E
}

/** Metadados declarativos usados pelos recursos avançados sem alterar o render atual. */
export interface FieldDef {
  name: string
  semantic: string
  type: 'text' | 'image' | 'boolean' | 'list' | 'number'
  required: boolean
  maxLength?: number
  bindable: boolean
}

export interface FieldSchema {
  fields: FieldDef[]
}

export interface TemplateCapabilities {
  image: boolean
  cta: boolean
  list: boolean
  resize: boolean
  styles: string[]
}

export interface TemplateVariant {
  id: string
  label: string
  density: 'short' | 'medium' | 'long'
  itemCount?: number
  hasImage: boolean
  ctaPosition?: 'none' | 'inline' | 'footer'
}

export interface FormatEquivalent {
  format: CanvasFormat
  templateId: string
}

export interface QualityRule {
  id: string
  field?: string
  severity: 'error' | 'warning' | 'info'
  check: 'required' | 'max-length' | 'image-required' | 'binding' | 'contrast'
  params: Record<string, unknown>
}

export interface LayoutAdjustment {
  property: 'fontScale' | 'lineHeight' | 'gapScale' | 'maxItems' | 'variantId'
  value: string | number
}

export interface LayoutRule {
  contentRange: 'short' | 'medium' | 'long'
  adjustments: LayoutAdjustment[]
}

export interface TemplateDefinition<E = Record<string, unknown>> {
  id: string
  name: string
  category: string
  filter: FormatFilter
  format: CanvasFormat
  tags: CareerTag[]
  defaults: E
  Render: React.FC<TemplateRenderProps<E>>
  Controls: React.FC<TemplateControlsProps<E>>
  fieldSchema?: FieldSchema
  capabilities?: TemplateCapabilities
  variants?: TemplateVariant[]
  equivalents?: FormatEquivalent[]
  qualityRules?: QualityRule[]
  layoutRules?: LayoutRule[]
}

/** Item de estatística (sq-stats). */
export interface StatItem {
  num: string
  label: string
}

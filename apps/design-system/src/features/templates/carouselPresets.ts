import type { CareerTag } from './types'

/**
 * Presets de carrossel: combinações prontas que definem a estrutura completa
 * (capa + N slides + CTA). Cada slot referencia um template cr-* do registry.
 * Fonte de verdade do Step 2 do wizard quando `filter === 'carousel'`.
 */
export interface CarouselPreset {
  id: string
  name: string
  description: string
  tags: CareerTag[]
  /** Template IDs por slot. Primeiro = capa, último = CTA (se houver). */
  slots: Array<{
    role: 'cover' | 'slide' | 'cta'
    templateId: string // referência a um cr-* do registry
    label: string // "Capa", "Slide Conteúdo 1", "CTA"
  }>
}

export const CAROUSEL_PRESETS: CarouselPreset[] = [
  {
    id: 'preset-educacional',
    name: 'Carrossel Educacional',
    description: 'Capa + 3 slides de conteúdo + CTA final. Formato didático do início ao fim.',
    tags: ['fiscal', 'policial', 'tribunal', 'motivacao'],
    slots: [
      { role: 'cover', templateId: 'cr-cover', label: 'Capa' },
      { role: 'slide', templateId: 'cr-slide', label: 'Slide Conteúdo 1' },
      { role: 'slide', templateId: 'cr-slide', label: 'Slide Conteúdo 2' },
      { role: 'slide', templateId: 'cr-slide', label: 'Slide Conteúdo 3' },
      { role: 'cta', templateId: 'cr-cta', label: 'CTA' },
    ],
  },
  {
    id: 'preset-lista',
    name: 'Carrossel Lista / Passo a Passo',
    description: 'Capa + lista de passos em 3 slides + CTA final. Ideal para roteiros e guias.',
    tags: ['fiscal', 'policial', 'tribunal'],
    slots: [
      { role: 'cover', templateId: 'cr-cover', label: 'Capa' },
      { role: 'slide', templateId: 'cr-list', label: 'Passo 1' },
      { role: 'slide', templateId: 'cr-list', label: 'Passo 2' },
      { role: 'slide', templateId: 'cr-list', label: 'Passo 3' },
      { role: 'cta', templateId: 'cr-cta', label: 'CTA' },
    ],
  },
  {
    id: 'preset-impacto',
    name: 'Carrossel de Impacto',
    description: 'Capa escura + fato marcante + antes vs depois + CTA. Máximo impacto em 4 slides.',
    tags: ['fiscal', 'policial', 'tribunal', 'motivacao'],
    slots: [
      { role: 'cover', templateId: 'cr-cover-dark', label: 'Capa Escura' },
      { role: 'slide', templateId: 'cr-fact', label: 'Fato / Destaque' },
      { role: 'slide', templateId: 'cr-comparison', label: 'Antes vs Depois' },
      { role: 'cta', templateId: 'cr-cta', label: 'CTA' },
    ],
  },
  {
    id: 'preset-misto',
    name: 'Carrossel Misto',
    description: 'Capa + conteúdo, texto com imagem, lista, fato e CTA. Estrutura completa em 6 slides.',
    tags: ['fiscal', 'policial', 'tribunal', 'motivacao'],
    slots: [
      { role: 'cover', templateId: 'cr-cover', label: 'Capa' },
      { role: 'slide', templateId: 'cr-slide', label: 'Slide Conteúdo' },
      { role: 'slide', templateId: 'cr-text-image', label: 'Texto + Imagem' },
      { role: 'slide', templateId: 'cr-list', label: 'Lista / Passos' },
      { role: 'slide', templateId: 'cr-fact', label: 'Fato / Destaque' },
      { role: 'cta', templateId: 'cr-cta', label: 'CTA' },
    ],
  },
  {
    id: 'preset-curto',
    name: 'Carrossel Curto',
    description: 'Capa + 1 slide de conteúdo + CTA. Direto ao ponto em apenas 3 slides.',
    tags: ['fiscal', 'policial', 'tribunal', 'motivacao'],
    slots: [
      { role: 'cover', templateId: 'cr-cover', label: 'Capa' },
      { role: 'slide', templateId: 'cr-slide', label: 'Slide Conteúdo' },
      { role: 'cta', templateId: 'cr-cta', label: 'CTA' },
    ],
  },
]

export function getPresetById(id: string): CarouselPreset | undefined {
  return CAROUSEL_PRESETS.find((p) => p.id === id)
}
import { decorToDocument } from '@/domain/adapters'
import { createProject, stableId, type ProjectDocument } from '@/domain/documents'
import { getDefaultElements, getTemplateById } from '@/features/templates/registry'
import type { TextureType, WatermarkPosition } from '@/stores/useDecorStore'

type DecorSnapshot = {
  texture: { type: TextureType; enabled: boolean; opacity: number }
  watermark: {
    enabled: boolean
    text: string
    position: WatermarkPosition
    opacity: number
  }
  bgLibrarySelected: string
}

/**
 * Cria uma edição independente a partir de modelos de catálogo.
 * Os defaults são clonados para o documento: nenhuma alteração feita no editor
 * alcança o registro imutável de modelos.
 */
export function createEditionFromTemplates(
  templateIds: string[],
  decor: DecorSnapshot,
): ProjectDocument {
  const templates = templateIds.map(getTemplateById).filter((template) => Boolean(template))
  if (templates.length === 0) throw new Error('Selecione pelo menos um modelo válido.')

  const isCarousel = templates.length > 1 || templates[0]!.filter === 'carousel'
  const project = createProject(
    isCarousel ? 'Novo carrossel' : `Edição: ${templates[0]!.name}`,
  )

  project.campaigns = [
    {
      id: stableId('campaign'),
      name: 'Campanha padrão',
      status: 'draft',
      linkedComponents: [],
      featurePreferences: {},
      artifacts: [
        {
          id: stableId('artifact'),
          kind: isCarousel ? 'carousel' : templates[0]!.format === 'portrait' ? 'story' : 'post',
          cards: templates.map((template) => ({
            id: stableId('card'),
            templateId: template!.id,
            elements: getDefaultElements(template!.id),
            darkMode: false,
            decor: decorToDocument(decor),
          })),
        },
      ],
    },
  ]

  return project
}

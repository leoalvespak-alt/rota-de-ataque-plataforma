import type { CardDocument, DecorDocument } from './documents'
import { stableId } from './documents'
import type { TextureType, WatermarkPosition } from '@/stores/useDecorStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useDecorStore } from '@/stores/useDecorStore'
import { useSeriesStore, type SeriesSlide } from '@/stores/useSeriesStore'
import type { ProjectDocument } from './documents'

type EditorSnapshot = { activeTemplateId: string | null; elements: Record<string, unknown>; darkMode: boolean }
type DecorSnapshot = { texture: { type: TextureType; enabled: boolean; opacity: number }; watermark: { enabled: boolean; text: string; position: WatermarkPosition; opacity: number }; bgLibrarySelected: string }

export function decorToDocument(decor: DecorSnapshot): DecorDocument {
  return {
    texture: { type: decor.texture.enabled ? decor.texture.type : 'none', opacity: decor.texture.opacity },
    watermark: { visible: decor.watermark.enabled, text: decor.watermark.text, position: decor.watermark.position, opacity: decor.watermark.opacity },
    bgLibraryId: decor.bgLibrarySelected,
  }
}

export function editorToCard(editor: EditorSnapshot, decor: DecorSnapshot, id = stableId('card')): CardDocument | undefined {
  if (!editor.activeTemplateId) return undefined
  return { id, templateId: editor.activeTemplateId, elements: structuredClone(editor.elements), darkMode: editor.darkMode, decor: decorToDocument(decor) }
}

export function slideToCard(slide: SeriesSlide): CardDocument {
  return {
    id: slide.id, templateId: slide.templateId, elements: structuredClone(slide.elements), darkMode: slide.darkMode,
    decor: {
      texture: { type: slide.texture.enabled ? slide.texture.type : 'none', opacity: slide.texture.opacity },
      watermark: { visible: slide.watermark.enabled, text: slide.watermark.text, position: slide.watermark.position, opacity: slide.watermark.opacity }, bgLibraryId: 'none',
    },
  }
}

/** Restaura o primeiro artefato do documento para os stores legados sem alterar seus contratos públicos. */
export function loadProjectIntoLegacyStores(project: ProjectDocument): boolean {
  const artifact = project.campaigns[0]?.artifacts[0]
  const first = artifact?.cards[0]
  if (!artifact || !first) return false
  const editor = useEditorStore.getState()
  editor.selectTemplate(first.templateId)
  editor.replaceElements(structuredClone(first.elements), { darkMode: first.darkMode })
  const decor = useDecorStore.getState()
  decor.setTexture(first.decor.texture.type)
  decor.toggleTexture(first.decor.texture.type !== 'none')
  decor.setTextureOpacity(first.decor.texture.opacity * 100)
  decor.setWatermarkEnabled(first.decor.watermark.visible)
  decor.setWatermarkText(first.decor.watermark.text)
  decor.setWatermarkPosition(first.decor.watermark.position)
  decor.setWatermarkOpacity(first.decor.watermark.opacity * 100)
  decor.setBgLibrarySelected(first.decor.bgLibraryId)
  const slides: SeriesSlide[] = artifact.kind === 'carousel' ? artifact.cards.map((card) => ({
    id: card.id, templateId: card.templateId, elements: structuredClone(card.elements), darkMode: card.darkMode,
    watermark: { enabled: card.decor.watermark.visible, text: card.decor.watermark.text, position: card.decor.watermark.position, opacity: card.decor.watermark.opacity },
    texture: { type: card.decor.texture.type, enabled: card.decor.texture.type !== 'none', opacity: card.decor.texture.opacity },
  })) : []
  useSeriesStore.setState({
    slides,
    seriesMode: artifact.kind === 'carousel',
    activeSlideId: artifact.kind === 'carousel' ? (slides[0]?.id ?? null) : null,
  })
  return true
}

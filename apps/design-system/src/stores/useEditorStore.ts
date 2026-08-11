import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import { TEMPLATES, getTemplateById, getDefaultElements } from '@/features/templates/registry'
import type { CanvasFormat } from '@/features/templates/types'

export const ZOOM_LEVELS = [0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 1] as const
export type ZoomLevel = (typeof ZOOM_LEVELS)[number]

interface EditorState {
  activeTemplateId: string | null
  format: CanvasFormat
  darkMode: boolean
  zoom: ZoomLevel
  /** Conteúdo do template ativo — shape varia por template (ver registry.ts). */
  elements: Record<string, unknown>
}

interface EditorActions {
  selectTemplate: (id: string, opts?: { keepElements?: boolean }) => void
  setElementField: (path: (string | number)[], value: unknown) => void
  toggleElementVisibility: (field: string) => void
  toggleDarkMode: () => void
  setZoom: (zoom: ZoomLevel) => void
  resetCard: () => void
  replaceElements: (elements: Record<string, unknown>, opts?: { darkMode?: boolean }) => void
}

type EditorStore = EditorState & EditorActions

/**
 * Núcleo do editor. Substitui `state.elements` / `state.activeTemplate` / `state.darkMode` /
 * `state.zoom` do Gerador/index.html original.
 *
 * `setElementField` substitui o antigo `setByPath` (correção da auditoria, item 1-2):
 * aqui o caminho já vem tipado como array de chaves/índices, gravado via Immer —
 * a classe de bug "grava em chave que ninguém lê" deixa de ser possível de escrever
 * porque o path é construído a partir do próprio template ativo (ver EditableText, Fase 5).
 */
export const useEditorStore = create<EditorStore>()(
  temporal(
    immer((set, get) => ({
      activeTemplateId: null,
      format: 'square',
      darkMode: false,
      zoom: 0.4,
      elements: {},

      selectTemplate: (id, opts = {}) => {
        const tpl = getTemplateById(id)
        if (!tpl) return
        set((s) => {
          s.activeTemplateId = id
          s.format = tpl.format
          if (!opts.keepElements) {
            s.elements = structuredClone(tpl.defaults) as Record<string, unknown>
          }
        })
      },

      setElementField: (path, value) => {
        set((s) => {
          let cur: Record<string, unknown> = s.elements
          for (let i = 0; i < path.length - 1; i++) {
            const key = path[i]!
            const next = cur[key as keyof typeof cur]
            if (next == null || typeof next !== 'object') {
              const nextKey = path[i + 1]
              cur[key as string] = typeof nextKey === 'number' ? [] : {}
            }
            cur = cur[key as keyof typeof cur] as Record<string, unknown>
          }
          const lastKey = path[path.length - 1]!
          ;(cur as Record<string | number, unknown>)[lastKey] = value
        })
      },

      toggleElementVisibility: (field) => {
        const tplId = get().activeTemplateId
        if (!tplId) return
        const tpl = getTemplateById(tplId)
        if (!tpl) return
        set((s) => {
          const current = s.elements[field]
          if (current === false) {
            const fallback = (tpl.defaults as Record<string, unknown>)[field]
            s.elements[field] = fallback ?? 'Texto'
          } else {
            s.elements[field] = false
          }
        })
      },

      toggleDarkMode: () => {
        set((s) => {
          s.darkMode = !s.darkMode
        })
      },

      setZoom: (zoom) => {
        set((s) => {
          s.zoom = zoom
        })
      },

      resetCard: () => {
        const tplId = get().activeTemplateId
        if (!tplId) return
        const tpl = getTemplateById(tplId)
        if (!tpl) return
        set((s) => {
          s.elements = structuredClone(tpl.defaults) as Record<string, unknown>
          s.darkMode = false
        })
      },

      replaceElements: (elements, opts = {}) => {
        set((s) => {
          s.elements = elements
          if (opts.darkMode !== undefined) s.darkMode = opts.darkMode
        })
      },
    })),
    {
      // Espelha o limite de 30 estados do undoStack original (Gerador/index.html linha 3014).
      limit: 30,
      // Só rastreia `elements` no histórico — trocar de template/zoom/tema não deveria
      // empilhar undo (mesmo comportamento do pushUndo original, que só olha state.elements).
      partialize: (state) => ({ elements: state.elements }),
    },
  ),
)

export const getAllTemplates = () => TEMPLATES
export { getDefaultElements }

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { createIdbStorage } from '@/lib/storage/idbStorage'
import type { TextureType, WatermarkPosition } from './useDecorStore'

export type RenderCategory = 'pessoas' | 'brasoes' | 'objetos' | 'icones'

export interface RenderCategoryDef {
  id: RenderCategory
  label: string
  icon: string
}

/** Espelha RENDER_CATEGORIES do Gerador/index.html (linhas 2006-2011). */
export const RENDER_CATEGORIES: RenderCategoryDef[] = [
  { id: 'pessoas', label: 'Pessoas', icon: '👤' },
  { id: 'brasoes', label: 'Brasões', icon: '🛡️' },
  { id: 'objetos', label: 'Objetos', icon: '📦' },
  { id: 'icones', label: 'Ícones', icon: '🎯' },
]

export interface SavedRender {
  id: string
  name: string
  category: RenderCategory | string
  /** Blob em vez de data-URL base64 — bem mais leve em IndexedDB do que era em localStorage. */
  blob: Blob
  uploadedAt: number
}

export interface SavedArt {
  id: string
  templateId: string
  elements: Record<string, unknown>
  darkMode: boolean
  watermark: { enabled: boolean; text: string; position: WatermarkPosition; opacity: number }
  texture: { type: TextureType; enabled: boolean; opacity: number }
  timestamp: number
  thumb: Blob | null
}

interface LibraryState {
  renders: SavedRender[]
  history: SavedArt[]
}

interface LibraryActions {
  addRender: (render: Omit<SavedRender, 'id' | 'uploadedAt'>) => void
  deleteRender: (id: string) => void
  addArt: (art: Omit<SavedArt, 'id' | 'timestamp'>) => void
  deleteArt: (id: string) => void
}

/**
 * Substitui localStorage `rda_renders` e `rda_history` do Gerador/index.html original
 * (funções loadRenders/saveRenderObj/deleteRender linhas 3568-3585, e
 * loadHistory/saveCurrentArt/deleteArt linhas 3668-3713).
 *
 * Mudança de infraestrutura (resolve D2 da auditoria): dados agora ficam em IndexedDB
 * como Blob nativo, não mais base64 em localStorage — mesmo limite de 20 artes no histórico
 * (linha 3700 do original), mesmas 4 categorias de render.
 */
export const useLibraryStore = create<LibraryState & LibraryActions>()(
  persist(
    immer((set) => ({
      renders: [],
      history: [],

      addRender: (render) =>
        set((s) => {
          s.renders.push({ id: Date.now().toString(), uploadedAt: Date.now(), ...render })
        }),

      deleteRender: (id) =>
        set((s) => {
          s.renders = s.renders.filter((r) => r.id !== id)
        }),

      addArt: (art) =>
        set((s) => {
          s.history.unshift({ id: Date.now().toString(), timestamp: Date.now(), ...art })
          if (s.history.length > 20) s.history.pop()
        }),

      deleteArt: (id) =>
        set((s) => {
          s.history = s.history.filter((a) => a.id !== id)
        }),
    })),
    {
      name: 'rda-library-v1',
      storage: createIdbStorage(),
    },
  ),
)

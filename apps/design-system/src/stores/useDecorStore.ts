import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type TextureType = 'none' | 'organic' | 'noise' | 'hatching'
export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'bottom-center'

export interface BgLibraryItem {
  id: string
  label: string
  type: 'none' | 'gradient' | 'solid'
  value?: string
}

/** Espelha BG_LIBRARY do Gerador/index.html (linhas 1993-2004) — 1:1, mesmos 9 itens + "nenhum". */
export const BG_LIBRARY: BgLibraryItem[] = [
  { id: 'none', label: 'Nenhum', type: 'none' },
  { id: 'grad-dark', label: 'Escuro Tático', type: 'gradient', value: 'linear-gradient(135deg,#0A0A0A 0%,#1a0a0a 100%)' },
  { id: 'grad-red', label: 'Vermelho Fundo', type: 'gradient', value: 'linear-gradient(135deg,#1a0000 0%,#3d0000 100%)' },
  { id: 'grad-slate', label: 'Ardósia', type: 'gradient', value: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)' },
  { id: 'grad-sand', label: 'Areia', type: 'gradient', value: 'linear-gradient(135deg,#F5F5F0 0%,#EAEAE5 100%)' },
  { id: 'grad-fog', label: 'Névoa Fria', type: 'gradient', value: 'linear-gradient(135deg,#e8e8f0 0%,#d0d0e0 100%)' },
  { id: 'solid-black', label: 'Preto Puro', type: 'solid', value: '#0A0A0A' },
  { id: 'solid-white', label: 'Branco Papel', type: 'solid', value: '#F5F5F0' },
  { id: 'solid-red', label: 'Vermelho Marca', type: 'solid', value: '#C1121F' },
  { id: 'solid-gold', label: 'Dourado', type: 'solid', value: '#D4A017' },
]

interface DecorState {
  texture: { type: TextureType; enabled: boolean; opacity: number }
  watermark: { enabled: boolean; text: string; position: WatermarkPosition; opacity: number }
  bgLibrarySelected: string
}

interface DecorActions {
  setTexture: (type: TextureType) => void
  toggleTexture: (enabled: boolean) => void
  setTextureOpacity: (opacityPercent: number) => void
  setWatermarkEnabled: (enabled: boolean) => void
  setWatermarkText: (text: string) => void
  setWatermarkPosition: (position: WatermarkPosition) => void
  setWatermarkOpacity: (opacityPercent: number) => void
  setBgLibrarySelected: (id: string) => void
}

/**
 * Substitui state.texture / state.watermark / state.bgLibrary do Gerador/index.html original
 * (linhas 1953-1954, 1957). Mesmos defaults: texture 8% (linha 1953), watermark 60% opacity
 * "rotadeataque.com.br" bottom-right (linha 1957).
 */
export const useDecorStore = create<DecorState & DecorActions>()(
  immer((set) => ({
    texture: { type: 'none', enabled: false, opacity: 0.08 },
    watermark: {
      enabled: false,
      text: 'rotadeataque.com.br',
      position: 'bottom-right',
      opacity: 0.6,
    },
    bgLibrarySelected: 'none',

    setTexture: (type) =>
      set((s) => {
        s.texture.type = type
        s.texture.enabled = type !== 'none'
      }),
    toggleTexture: (enabled) =>
      set((s) => {
        s.texture.enabled = enabled
      }),
    setTextureOpacity: (opacityPercent) =>
      set((s) => {
        s.texture.opacity = opacityPercent / 100
      }),
    setWatermarkEnabled: (enabled) =>
      set((s) => {
        s.watermark.enabled = enabled
      }),
    setWatermarkText: (text) =>
      set((s) => {
        s.watermark.text = text
      }),
    setWatermarkPosition: (position) =>
      set((s) => {
        s.watermark.position = position
      }),
    setWatermarkOpacity: (opacityPercent) =>
      set((s) => {
        s.watermark.opacity = opacityPercent / 100
      }),
    setBgLibrarySelected: (id) =>
      set((s) => {
        s.bgLibrarySelected = id
      }),
  })),
)

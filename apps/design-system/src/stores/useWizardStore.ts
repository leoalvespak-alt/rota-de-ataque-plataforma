import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CanvasFormat, FormatFilter } from '@/features/templates/types'

export type CreativeType = 'post' | 'carousel' | 'story'
export type AspectRatio = 'square' | 'portrait'
export type WizardStep = 1 | 2 | 3 | 4 | 5

export type ContentSource = 'thesis' | 'free' | 'markdown'

export interface ScriptCard {
  id: string
  role: 'cover' | 'slide' | 'cta'
  title: string
  body: string
  eyebrow?: string
  generating?: boolean
}

interface WizardState {
  active: boolean
  step: WizardStep
  creativeType: CreativeType | null
  aspectRatio: AspectRatio | null
  templateId: string | null
  thesisId: string | null
  freeText: string
  cardCount: number
  generateCoverWithAI: boolean
  scriptCards: ScriptCard[]
  projectId: string | null
  contentSource: ContentSource
  profileId: string | null
}

interface WizardActions {
  startWizard: () => void
  exitWizard: () => void
  setStep: (step: WizardStep) => void
  nextStep: () => void
  prevStep: () => void
  setCreativeType: (type: CreativeType) => void
  setAspectRatio: (ratio: AspectRatio) => void
  setTemplateId: (id: string) => void
  setThesisId: (id: string | null) => void
  setFreeText: (text: string) => void
  setCardCount: (count: number) => void
  setGenerateCoverWithAI: (value: boolean) => void
  setScriptCards: (cards: ScriptCard[]) => void
  updateScriptCard: (id: string, patch: Partial<ScriptCard>) => void
  clearScriptCard: (id: string) => void
  setProjectId: (id: string | null) => void
  setContentSource: (source: ContentSource) => void
  setProfileId: (id: string | null) => void
  resetWizard: () => void
  getResolvedFormat: () => CanvasFormat
  getResolvedFilter: () => FormatFilter
  canAdvance: () => boolean
}

const initialState: WizardState = {
  active: false,
  step: 1,
  creativeType: null,
  aspectRatio: null,
  templateId: null,
  thesisId: null,
  freeText: '',
  cardCount: 1,
  generateCoverWithAI: false,
  scriptCards: [],
  projectId: null,
  contentSource: 'free',
  profileId: null,
}

export const useWizardStore = create<WizardState & WizardActions>()(
  immer((set, get) => ({
    ...initialState,

    startWizard: () => set((s) => { Object.assign(s, { ...initialState, active: true }) }),
    exitWizard: () => set((s) => { s.active = false }),

    setStep: (step) => set((s) => { s.step = step }),
    nextStep: () => set((s) => {
      if (s.step < 5) s.step = (s.step + 1) as WizardStep
    }),
    prevStep: () => set((s) => {
      if (s.step > 1) s.step = (s.step - 1) as WizardStep
    }),

    setCreativeType: (type) => set((s) => {
      s.creativeType = type
      if (type === 'story') {
        s.aspectRatio = 'portrait'
      } else {
        s.aspectRatio = null
      }
    }),

    setAspectRatio: (ratio) => set((s) => { s.aspectRatio = ratio }),
    setTemplateId: (id) => set((s) => { s.templateId = id }),
    setThesisId: (id) => set((s) => { s.thesisId = id }),
    setFreeText: (text) => set((s) => { s.freeText = text }),

    setCardCount: (count) => set((s) => {
      s.cardCount = Math.max(1, Math.min(10, count))
    }),

    setGenerateCoverWithAI: (value) => set((s) => { s.generateCoverWithAI = value }),

    setScriptCards: (cards) => set((s) => { s.scriptCards = cards }),

    updateScriptCard: (id, patch) => set((s) => {
      const card = s.scriptCards.find((c) => c.id === id)
      if (card) Object.assign(card, patch)
    }),

    clearScriptCard: (id) => set((s) => {
      const card = s.scriptCards.find((c) => c.id === id)
      if (card) {
        card.title = ''
        card.body = ''
        card.eyebrow = ''
      }
    }),

    setProjectId: (id) => set((s) => { s.projectId = id }),
    setContentSource: (source) => set((s) => { s.contentSource = source }),
    setProfileId: (id) => set((s) => { s.profileId = id }),

    resetWizard: () => set(() => ({ ...initialState })),

    getResolvedFormat: () => {
      const s = get()
      if (s.creativeType === 'story') return 'portrait'
      return s.aspectRatio === 'portrait' ? 'portrait' : 'square'
    },

    getResolvedFilter: () => {
      const s = get()
      if (s.creativeType === 'carousel') return 'carousel'
      if (s.creativeType === 'story') return 'portrait'
      return s.aspectRatio === 'portrait' ? 'portrait' : 'square'
    },

    canAdvance: () => {
      const s = get()
      switch (s.step) {
        case 1:
          if (!s.creativeType) return false
          if (s.creativeType !== 'story' && !s.aspectRatio) return false
          return true
        case 2:
          return !!s.templateId
        case 3:
          if (s.cardCount < 1 || s.cardCount > 10) return false
          if (s.contentSource === 'markdown') return s.scriptCards.length > 0
          return s.freeText.trim().length > 0 || !!s.thesisId
          case 4:
          return s.scriptCards.length > 0 && s.scriptCards.every((c) => c.title.trim().length > 0)
        case 5:
          return true
        default:
          return false
      }
    },
  })),
)

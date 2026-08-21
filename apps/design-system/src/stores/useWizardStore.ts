import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CanvasFormat, FormatFilter } from '@/features/templates/types'
import { getPresetById } from '@/features/templates/carouselPresets'
import { getTemplateContract } from '@/domain/templateContracts'

export type CreativeType = 'post' | 'carousel' | 'story'
export type AspectRatio = 'square' | 'portrait'
export type WizardStep = 1 | 2 | 3 | 4 | 5

export type ContentSource = 'thesis' | 'free' | 'markdown'

export interface ScriptCard {
  id: string
  role: 'cover' | 'slide' | 'cta'
  templateId?: string
  fields: Record<string, string>
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
  presetId: string | null
  slideTemplateIds: Record<number, string>
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
  setPresetId: (id: string) => void
  setSlideTemplateId: (index: number, templateId: string) => void
  getTemplateForSlide: (index: number) => string | null
  setThesisId: (id: string | null) => void
  setFreeText: (text: string) => void
  setCardCount: (count: number) => void
  setCarouselCardCount: (count: number) => void
  setGenerateCoverWithAI: (value: boolean) => void
  setScriptCards: (cards: ScriptCard[]) => void
  updateScriptCard: (id: string, patch: Partial<ScriptCard>) => void
  clearScriptCard: (id: string) => void
  setProjectId: (id: string | null) => void
  setContentSource: (source: ContentSource) => void
  setProfileId: (id: string | null) => void
  resetWizard: () => void
  loadWizardData: (data: Partial<WizardState>) => void
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
  presetId: null,
  slideTemplateIds: {},
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

    setPresetId: (id) => set((s) => {
      const preset = getPresetById(id)
      s.presetId = preset ? id : null
      if (!preset) return
      s.templateId = preset.slots[0]?.templateId ?? null
      s.slideTemplateIds = Object.fromEntries(
        preset.slots.map((slot, i) => [i, slot.templateId]),
      )
      s.cardCount = preset.slots.length
    }),

    setSlideTemplateId: (index, templateId) => set((s) => {
      s.slideTemplateIds[index] = templateId
    }),

    getTemplateForSlide: (index) => {
      const s = get()
      return s.slideTemplateIds[index] ?? s.templateId
    },
    setThesisId: (id) => set((s) => { s.thesisId = id }),
    setFreeText: (text) => set((s) => { s.freeText = text }),

    setCardCount: (count) => set((s) => {
      s.cardCount = Math.max(1, Math.min(10, count))
    }),

    setCarouselCardCount: (count) => set((s) => {
      const clamped = Math.max(1, Math.min(10, count))
      s.cardCount = clamped
      const preset = s.presetId ? getPresetById(s.presetId) : undefined
      if (!preset) return

      const coverTpl = preset.slots[0]?.templateId ?? s.templateId ?? 'cr-cover'
      const lastSlot = preset.slots[preset.slots.length - 1]
      const ctaTpl = lastSlot?.role === 'cta' ? lastSlot.templateId : undefined
      const slideTemplates = preset.slots
        .filter((sl) => sl.role === 'slide')
        .map((sl) => sl.templateId)
      const counts = new Map<string, number>()
      for (const id of slideTemplates) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      let mostCommon = slideTemplates[0] ?? coverTpl
      for (const [id, n] of counts) {
        if (n > (counts.get(mostCommon) ?? 0)) mostCommon = id
      }

      const ids: Record<number, string> = { 0: coverTpl }
      for (let i = 1; i < clamped - 1; i++) ids[i] = mostCommon
      if (clamped > 1 && ctaTpl) ids[clamped - 1] = ctaTpl
      s.slideTemplateIds = ids
    }),

    setGenerateCoverWithAI: (value) => set((s) => { s.generateCoverWithAI = value }),

    setScriptCards: (cards) => set((s) => { s.scriptCards = cards }),

    updateScriptCard: (id, patch) => set((s) => {
      const card = s.scriptCards.find((c) => c.id === id)
      if (card) {
        Object.assign(card, patch)
        if (patch.title !== undefined) card.fields.title = patch.title
        if (patch.body !== undefined) {
          card.fields.body = patch.body
          if ('subtitle' in card.fields) card.fields.subtitle = patch.body
          if ('text' in card.fields) card.fields.text = patch.body
        }
        if (patch.eyebrow !== undefined) card.fields.eyebrow = patch.eyebrow
      }
    }),

    clearScriptCard: (id) => set((s) => {
      const card = s.scriptCards.find((c) => c.id === id)
      if (card) {
        for (const key of Object.keys(card.fields)) card.fields[key] = ''
        card.title = ''
        card.body = ''
        card.eyebrow = ''
      }
    }),

    setProjectId: (id) => set((s) => { s.projectId = id }),
    setContentSource: (source) => set((s) => { s.contentSource = source }),
    setProfileId: (id) => set((s) => { s.profileId = id }),

    resetWizard: () => set(() => ({ ...initialState })),

    loadWizardData: (data) => set((s) => {
      Object.assign(s, { ...initialState, ...data, active: true })
    }),

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
          return !!s.templateId || !!s.presetId
        case 3:
          if (s.cardCount < 1 || s.cardCount > 10) return false
          if (s.contentSource === 'markdown') return s.freeText.trim().length > 0
          if (s.contentSource === 'thesis') return !!s.thesisId || s.freeText.trim().length > 0
          return s.freeText.trim().length > 0
        case 4:
          return s.scriptCards.length > 0 && s.scriptCards.every((card, index) => {
            const cardTemplateId = card.templateId ?? s.slideTemplateIds[index] ?? s.templateId
            const required = cardTemplateId
              ? getTemplateContract(cardTemplateId)?.fieldSchema.fields.filter(
                (field) => field.type === 'text' && field.required,
              ) ?? []
              : []
            if (required.length === 0) return Object.values(card.fields).some((value) => value.trim())
            return required.every((field) => card.fields[field.name]?.trim())
          })
        case 5:
          return true
        default:
          return false
      }
    },
  })),
)

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

export type AIProviderKind = 'deepseek' | 'claude' | 'openai-compat'

export interface AIModel {
  id: string
  label: string
  provider: AIProviderKind
  model: string
  /** Referência a uma das 3 chaves fixas (compat com o app original). */
  keyRef: 'deepseekKey' | 'claudeKey' | 'falKey'
  /**
   * 🆕 Chave própria opcional — resolve a dívida D6 da auditoria (item 10):
   * modelos customizados não precisam mais reaproveitar uma das 3 chaves fixas.
   * Quando presente, tem prioridade sobre `keyRef`.
   */
  customKey?: string
  baseUrl: string
  enabled: boolean
}

interface AIState {
  deepseekKey: string
  claudeKey: string
  falKey: string
  embeddingKey: string
  embeddingModel: string
  copyModel: string
  models: AIModel[]
  generatedImageUrl: string | null
}

interface AIActions {
  setKey: (key: 'deepseekKey' | 'claudeKey' | 'falKey' | 'embeddingKey', value: string) => void
  setEmbeddingModel: (model: string) => void
  setCopyModel: (id: string) => void
  addModel: (model: Omit<AIModel, 'id'>) => void
  updateModel: (id: string, patch: Partial<Omit<AIModel, 'id'>>) => void
  deleteModel: (id: string) => boolean
  toggleModel: (id: string) => boolean
  setGeneratedImageUrl: (url: string | null) => void
  resolveKeyForModel: (model: AIModel) => string
}

/** Espelha state.aiConfig.models[0..1] do Gerador/index.html original (linhas 1966-1985). */
const DEFAULT_MODELS: AIModel[] = [
  {
    id: 'deepseek-default',
    label: 'DeepSeek — mais barato (~55x)',
    provider: 'deepseek',
    model: 'deepseek-chat',
    keyRef: 'deepseekKey',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    enabled: true,
  },
  {
    id: 'claude-default',
    label: 'Claude Sonnet 4.6 — maior fidelidade de tom',
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    keyRef: 'claudeKey',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    enabled: true,
  },
]

/**
 * Substitui state.aiConfig do Gerador/index.html original (linhas 1961-1988).
 * Mantém o nome de persistência equivalente ao `rda_ai_keys` (localStorage) original —
 * dado que já existe na máquina do usuário continua acessível, só migra formato via `persist`.
 */
export const useAIStore = create<AIState & AIActions>()(
  persist(
    immer((set, get) => ({
      deepseekKey: '',
      claudeKey: '',
      falKey: '',
      embeddingKey: '',
      embeddingModel: 'text-embedding-3-small',
      copyModel: 'deepseek-default',
      models: DEFAULT_MODELS,
      generatedImageUrl: null,

      setKey: (key, value) =>
        set((s) => {
          s[key] = value
        }),

      setCopyModel: (id) =>
        set((s) => {
          s.copyModel = id
        }),

      setEmbeddingModel: (model) => set((s) => { s.embeddingModel = model }),

      addModel: (model) =>
        set((s) => {
          s.models.push({ id: `model-${Date.now()}`, ...model })
        }),

      updateModel: (id, patch) =>
        set((s) => {
          const m = s.models.find((x) => x.id === id)
          if (m) Object.assign(m, patch)
        }),

      deleteModel: (id) => {
        const { models } = get()
        const enabledCount = models.filter((m) => m.enabled).length
        const target = models.find((m) => m.id === id)
        if (target?.enabled && enabledCount === 1) return false // guarda: >=1 modelo habilitado
        set((s) => {
          s.models = s.models.filter((m) => m.id !== id)
          if (s.copyModel === id) {
            const first = s.models.find((m) => m.enabled)
            s.copyModel = first ? first.id : ''
          }
        })
        return true
      },

      toggleModel: (id) => {
        const { models } = get()
        const target = models.find((m) => m.id === id)
        if (!target) return false
        const nextEnabled = !target.enabled
        const enabledCount = models.filter((m) => m.enabled).length
        if (!nextEnabled && enabledCount === 1) return false // guarda: >=1 modelo habilitado
        set((s) => {
          const m = s.models.find((x) => x.id === id)
          if (m) m.enabled = nextEnabled
          if (!nextEnabled && s.copyModel === id) {
            const first = s.models.find((x) => x.enabled)
            s.copyModel = first ? first.id : ''
          }
        })
        return true
      },

      setGeneratedImageUrl: (url) =>
        set((s) => {
          s.generatedImageUrl = url
        }),

      resolveKeyForModel: (model) => {
        if (model.customKey) return model.customKey
        return get()[model.keyRef]
      },
    })),
    { name: 'rda_ai_keys' },
  ),
)

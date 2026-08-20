import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch } from '@/lib/api/client'

export type AIProviderKind = 'deepseek' | 'claude' | 'openai' | 'fal'
export type AIModelCapability = 'text' | 'image' | 'json' | 'streaming'

export interface AIModel {
  id: string
  label: string
  provider: AIProviderKind
  model: string
  capabilities: AIModelCapability[]
  enabled: boolean
  configured: boolean
}

export interface AIProvider {
  id: AIProviderKind
  label: string
  capabilities: AIModelCapability[]
  configured: boolean
}

interface AIState {
  copyModel: string
  imageModel: string
  models: AIModel[]
  providers: AIProvider[]
  generatedImageUrl: string | null
}

interface AIActions {
  setCopyModel: (id: string) => void
  setImageModel: (id: string) => void
  setCatalog: (models: AIModel[], providers: AIProvider[]) => void
  toggleModel: (id: string) => boolean
  deleteModel: (id: string) => boolean
  setGeneratedImageUrl: (url: string | null) => void
  getProviderById: (id: string) => AIProvider | undefined
  getActiveCopyModel: () => AIModel | undefined
  getActiveImageModel: () => AIModel | undefined
  getModelCapabilities: (modelId: string) => AIModelCapability[]
  testConnection: (modelId: string) => Promise<{ success: boolean; latency?: number; error?: string }>
}

export const SAFE_DEFAULT_MODELS: AIModel[] = [
  { id: 'deepseek-default', label: 'DeepSeek Chat', provider: 'deepseek', model: 'deepseek-chat', capabilities: ['text', 'json'], enabled: true, configured: false },
  { id: 'claude-default', label: 'Claude Sonnet', provider: 'claude', model: 'server-configured', capabilities: ['text', 'json'], enabled: true, configured: false },
  { id: 'fal-flux-schnell', label: 'FLUX Schnell', provider: 'fal', model: 'fal-ai/flux/schnell', capabilities: ['image'], enabled: true, configured: false },
]

const SAFE_DEFAULT_PROVIDERS: AIProvider[] = [
  { id: 'deepseek', label: 'DeepSeek', capabilities: ['text', 'json'], configured: false },
  { id: 'claude', label: 'Anthropic', capabilities: ['text', 'json'], configured: false },
  { id: 'fal', label: 'fal.ai', capabilities: ['image'], configured: false },
]

export const useAIStore = create<AIState & AIActions>()(
  persist(
    (set, get) => ({
      copyModel: 'claude-default',
      imageModel: 'fal-flux-schnell',
      models: SAFE_DEFAULT_MODELS,
      providers: SAFE_DEFAULT_PROVIDERS,
      generatedImageUrl: null,
      setCopyModel: (id) => set({ copyModel: id }),
      setImageModel: (id) => set({ imageModel: id }),
      setCatalog: (models, providers) => set({ models, providers }),
      toggleModel: (id) => {
        const model = get().models.find((item) => item.id === id)
        if (!model) return false
        if (model.enabled && get().models.filter((item) => item.enabled).length === 1) return false
        set({ models: get().models.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item) })
        return true
      },
      deleteModel: () => false,
      setGeneratedImageUrl: (generatedImageUrl) => set({ generatedImageUrl }),
      getProviderById: (id) => get().providers.find((provider) => provider.id === id),
      getActiveCopyModel: () => get().models.find((model) => model.id === get().copyModel && model.enabled),
      getActiveImageModel: () => get().models.find((model) => model.id === get().imageModel && model.enabled),
      getModelCapabilities: (modelId) => get().models.find((model) => model.id === modelId)?.capabilities ?? [],
      testConnection: async (modelId) => {
        const model = get().models.find((item) => item.id === modelId)
        if (!model) return { success: false, error: 'Modelo não encontrado.' }
        try {
          return await apiFetch(`/ai/providers/${model.provider}/test`, {
            method: 'POST',
            body: JSON.stringify({ model: model.id }),
          })
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Falha no teste.' }
        }
      },
    }),
    {
      name: 'rda_ai_preferences',
      version: 2,
      partialize: (state) => ({ copyModel: state.copyModel, imageModel: state.imageModel }),
      migrate: (persisted) => {
        const state = persisted as { copyModel?: string; imageModel?: string } | undefined
        return {
          copyModel: state?.copyModel === 'claude-sonnet-4-6' ? 'claude-default' : state?.copyModel ?? 'claude-default',
          imageModel: state?.imageModel === 'fal-dalle3' ? 'fal-flux-schnell' : state?.imageModel ?? 'fal-flux-schnell',
        }
      },
    },
  ),
)

import { beforeEach, describe, expect, it } from 'vitest'
import { SAFE_DEFAULT_MODELS, useAIStore } from './useAIStore'

describe('useAIStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAIStore.setState({
      copyModel: 'deepseek-default',
      imageModel: 'fal-flux-schnell',
      models: SAFE_DEFAULT_MODELS.map((model) => ({ ...model })),
      generatedImageUrl: null,
    })
  })

  it('não permite desabilitar o único modelo habilitado', () => {
    useAIStore.setState({ models: SAFE_DEFAULT_MODELS.map((model, index) => ({ ...model, enabled: index === 0 })) })
    expect(useAIStore.getState().toggleModel('deepseek-default')).toBe(false)
  })

  it('persiste somente preferências sem credenciais ou URLs', () => {
    useAIStore.getState().setCopyModel('claude-default')
    const persisted = localStorage.getItem('rda_ai_preferences') ?? ''
    expect(persisted).toContain('claude-default')
    expect(persisted).not.toMatch(/api[_-]?key|secret|token|baseUrl|https:\/\//i)
  })

  it('substitui o catálogo somente com metadados sanitizados', () => {
    const model = { ...SAFE_DEFAULT_MODELS[0]!, configured: true }
    useAIStore.getState().setCatalog([model], [])
    expect(useAIStore.getState().models).toEqual([model])
  })
})

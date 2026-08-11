import { describe, it, expect, beforeEach } from 'vitest'
import { useAIStore } from './useAIStore'

describe('useAIStore', () => {
  beforeEach(() => {
    useAIStore.persist.clearStorage()
    useAIStore.setState({
      deepseekKey: '',
      claudeKey: '',
      falKey: '',
      copyModel: 'deepseek-default',
      models: [
        {
          id: 'deepseek-default',
          label: 'DeepSeek',
          provider: 'deepseek',
          model: 'deepseek-chat',
          keyRef: 'deepseekKey',
          baseUrl: 'https://api.deepseek.com/chat/completions',
          enabled: true,
        },
        {
          id: 'claude-default',
          label: 'Claude',
          provider: 'claude',
          model: 'claude-3-5-sonnet-20241022',
          keyRef: 'claudeKey',
          baseUrl: 'https://api.anthropic.com/v1/messages',
          enabled: true,
        },
      ],
      generatedImageUrl: null,
    })
  })

  it('não permite desabilitar o único modelo habilitado', () => {
    useAIStore.getState().toggleModel('claude-default') // desabilita o segundo, ok
    const ok = useAIStore.getState().toggleModel('deepseek-default') // só resta 1 habilitado
    expect(ok).toBe(false)
    expect(useAIStore.getState().models.find((m) => m.id === 'deepseek-default')?.enabled).toBe(true)
  })

  it('não permite excluir o único modelo habilitado', () => {
    useAIStore.getState().toggleModel('claude-default')
    const ok = useAIStore.getState().deleteModel('deepseek-default')
    expect(ok).toBe(false)
    expect(useAIStore.getState().models).toHaveLength(2)
  })

  it('resolveKeyForModel prioriza customKey sobre a chave fixa (correção D6 da auditoria)', () => {
    useAIStore.setState({ deepseekKey: 'chave-fixa' })
    useAIStore.getState().updateModel('deepseek-default', { customKey: 'chave-propria' })
    const model = useAIStore.getState().models.find((m) => m.id === 'deepseek-default')!
    expect(useAIStore.getState().resolveKeyForModel(model)).toBe('chave-propria')
  })

  it('resolveKeyForModel cai para a chave fixa quando não há customKey', () => {
    useAIStore.setState({ deepseekKey: 'chave-fixa' })
    const model = useAIStore.getState().models.find((m) => m.id === 'deepseek-default')!
    expect(useAIStore.getState().resolveKeyForModel(model)).toBe('chave-fixa')
  })
})

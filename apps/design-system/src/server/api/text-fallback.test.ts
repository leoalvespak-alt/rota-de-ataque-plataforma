import { describe, expect, it } from 'vitest'
import { selectTextFallback } from './text-fallback'

const models = [
  { id: 'deepseek-default', provider: 'deepseek', keyEnv: 'DEEPSEEK_KEY', capabilities: ['text', 'json'] },
  { id: 'glm-fallback', provider: 'openrouter', keyEnv: 'OPENROUTER_API_KEY', capabilities: ['text', 'json'] },
  { id: 'claude-default', provider: 'claude', keyEnv: 'ANTHROPIC_KEY', capabilities: ['text', 'json'] },
]

describe('fallback de texto do Design System', () => {
  it('encaminha falhas do DeepSeek ao GLM mesmo quando Claude também está configurado', () => {
    expect(selectTextFallback(models[0]!, models, { OPENROUTER_API_KEY: 'configured', ANTHROPIC_KEY: 'configured' })).toBe(models[1])
  })

  it('não troca silenciosamente para Claude quando falta a chave específica do GLM', () => {
    expect(selectTextFallback(models[0]!, models, { ANTHROPIC_KEY: 'configured' })).toBeUndefined()
  })

  it('não aciona fallback GLM para um modelo primário diferente do DeepSeek', () => {
    expect(selectTextFallback(models[2]!, models, { OPENROUTER_API_KEY: 'configured' })).toBeUndefined()
  })

  it('trata variável vazia como ausência de credencial', () => {
    expect(selectTextFallback(models[0]!, models, { OPENROUTER_API_KEY: '   ' })).toBeUndefined()
  })
})

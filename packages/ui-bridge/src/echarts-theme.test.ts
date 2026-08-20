import { describe, expect, it } from 'vitest'
import { createBridgeTheme } from './echarts-theme'

describe('createBridgeTheme', () => {
  it('entrega cores concretas para o canvas em vez de variáveis CSS', () => {
    const theme = createBridgeTheme((token, fallback) => token === '--accent-primary' ? '#123456' : fallback)

    expect(theme.color[0]).toBe('#123456')
    expect(JSON.stringify(theme)).not.toContain('var(')
  })
})

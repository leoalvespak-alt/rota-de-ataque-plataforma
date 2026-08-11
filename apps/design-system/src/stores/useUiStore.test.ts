import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from './useUiStore'

describe('useUiStore theme', () => {
  beforeEach(() => {
    useUiStore.setState({ theme: 'dark' })
  })

  it('alternates between the complete light and dark UI themes', () => {
    useUiStore.getState().toggleTheme()
    expect(useUiStore.getState().theme).toBe('light')

    useUiStore.getState().toggleTheme()
    expect(useUiStore.getState().theme).toBe('dark')
  })
})

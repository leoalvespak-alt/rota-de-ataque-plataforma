'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type UiMode = 'simple' | 'advanced'

type UiModeValue = {
  mode: UiMode
  hydrated: boolean
  setMode: (mode: UiMode) => void
  revealAdvanced: () => void
}

const UiModeContext = createContext<UiModeValue | null>(null)

export function UiModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UiMode>('simple')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setModeState(localStorage.getItem('prospector_ui_mode') === 'advanced' ? 'advanced' : 'simple')
    setHydrated(true)
  }, [])

  const setMode = useCallback((next: UiMode) => {
    setModeState(next)
    localStorage.setItem('prospector_ui_mode', next)
  }, [])
  const revealAdvanced = useCallback(() => setMode('advanced'), [setMode])
  const value = useMemo(() => ({ mode, hydrated, setMode, revealAdvanced }), [mode, hydrated, setMode, revealAdvanced])

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>
}

export function useUiMode() {
  const value = useContext(UiModeContext)
  if (!value) throw new Error('useUiMode deve ser usado dentro de UiModeProvider')
  return value
}

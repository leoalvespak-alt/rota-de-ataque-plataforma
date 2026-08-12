'use client'
import { createContext, useContext } from 'react'
import type { FeatureFlags } from '@/lib/feature-flags'

const Ctx = createContext<FeatureFlags | null>(null)

export const useFlags = () => {
  const flags = useContext(Ctx)
  if (!flags) throw new Error('useFlags must be used inside <FeatureFlagProvider>')
  return flags
}

export function FeatureFlagProvider({ flags, children }: { flags: FeatureFlags; children: React.ReactNode }) {
  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>
}

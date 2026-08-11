import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** One independently releasable flag per item in the 22-resource rollout. */
export const FEATURE_IDS = ['projects', 'autosave', 'safe-mutations', 'brand-lock', 'smart-layouts', 'quality-validator', 'campaign-presets', 'linked-components', 'content-library', 'command-center', 'reusable-data', 'batch-import', 'multiformat', 'ai-assistant', 'ai-carousel', 'variations', 'campaign-packages', 'workflow', 'planning', 'export-profiles', 'text-styles', 'conditional-composition', 'editorial-engine', 'editorial-theses', 'editorial-knowledge-base', 'editorial-planner', 'editorial-batch', 'editorial-calendar', 'editorial-similarity', 'editorial-quality', 'editorial-prompts'] as const
export type FeatureId = (typeof FEATURE_IDS)[number]
type FeatureFlags = Record<FeatureId, boolean>

const defaults = Object.fromEntries(FEATURE_IDS.map((id) => [id, false])) as FeatureFlags

interface FeatureFlagStore { flags: FeatureFlags; set: (id: FeatureId, enabled: boolean) => void; reset: () => void }
export const useFeatureFlags = create<FeatureFlagStore>()(persist((set) => ({
  flags: defaults,
  set: (id, enabled) => set((state) => ({ flags: { ...state.flags, [id]: enabled } })),
  reset: () => set({ flags: defaults }),
}), { name: 'rda_feature_flags' }))

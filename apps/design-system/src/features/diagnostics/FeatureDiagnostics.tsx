import { FEATURE_IDS, useFeatureFlags } from '@/domain/featureFlags'

/** Painel exclusivamente de desenvolvimento: abra com ?diagnostics para liberar recursos gradualmente. */
export function FeatureDiagnostics() {
  const flags = useFeatureFlags((state) => state.flags)
  const set = useFeatureFlags((state) => state.set)
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('diagnostics')) return null
  return (
    <aside className="fixed right-3 bottom-3 z-[100] w-72 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-2xl">
      <p className="mb-2 text-xs font-bold tracking-wide text-ui-text uppercase">Feature flags</p>
      <div className="max-h-80 space-y-1 overflow-y-auto text-xs text-ui-muted">
        {FEATURE_IDS.map((id) => (
          <label key={id} className="flex cursor-pointer items-center justify-between gap-3 rounded px-1 py-1 hover:bg-ui-panel2">
            <span>{id}</span>
            <input type="checkbox" checked={flags[id]} onChange={(event) => set(id, event.target.checked)} />
          </label>
        ))}
      </div>
    </aside>
  )
}

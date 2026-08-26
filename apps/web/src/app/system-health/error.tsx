'use client'

import { ErrorState } from '@plataforma/ui-bridge'

export default function SystemHealthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page"><ErrorState traceId={error.digest ?? 'trace_indisponivel'} runbook="/docs/runbooks/system-health" onRetry={reset} /><p role="status">Nenhuma ação operacional foi aplicada. Tente novamente ou consulte o runbook.</p></main>
}

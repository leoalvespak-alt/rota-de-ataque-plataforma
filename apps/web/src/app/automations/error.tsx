'use client'

import { ErrorState } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'

export default function AutomationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page"><ErrorState traceId={error.digest ?? 'trace_indisponivel'} runbook={appPath('/docs/runbooks/automations')} onRetry={reset} /><p role="status">As filas não foram alteradas. Tente novamente ou consulte o runbook operacional.</p></main>
}

'use client'

import { ErrorState } from '@plataforma/ui-bridge'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page"><ErrorState traceId={error.digest ?? 'trace_indisponivel'} runbook="/docs/runbooks/web" onRetry={reset} /></div>
}

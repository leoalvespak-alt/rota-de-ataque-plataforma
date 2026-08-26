'use client'

import { ErrorState } from '@plataforma/ui-bridge'

export default function AudienceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page"><ErrorState traceId={error.digest ?? 'trace_indisponivel'} runbook="/docs/runbooks/web" onRetry={reset} message="O Público não pôde carregar a partir das fontes de relacionamento." /></main>
}

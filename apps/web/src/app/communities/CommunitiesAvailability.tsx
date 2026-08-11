'use client'

import { useState } from 'react'
import { appPath } from '@/lib/base-path'

type Availability = { available: boolean; checked: boolean; checkedAt: string; reason: string; missing?: string[]; accountName?: string }

const reasonLabel: Record<string, string> = {
  available: 'Groups API disponível para esta conta.',
  feature_flag_disabled: 'Conta consultada, mas a liberação da Groups API ainda não foi confirmada.',
  missing_credentials: 'Adicione as credenciais Meta para realizar a consulta.',
  provider_rejected: 'A Meta recusou a consulta. Revise as credenciais e permissões.',
  provider_unreachable: 'Não foi possível alcançar a Meta nesta tentativa.',
}

export function CommunitiesAvailability() {
  const [result, setResult] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(false)

  async function check() {
    setLoading(true)
    try {
      const response = await fetch(appPath('/api/admin/whatsapp-groups/availability'), { cache: 'no-store' })
      setResult(await response.json() as Availability)
    } finally { setLoading(false) }
  }

  return <div className="availability-check">
    <button type="button" onClick={check} disabled={loading}>{loading ? 'Verificando…' : 'Verificar disponibilidade'}</button>
    {result && <p role="status">
      <strong>{result.available ? 'Disponível' : 'Indisponível'}.</strong>{' '}{reasonLabel[result.reason] ?? result.reason}
      {result.missing?.length ? ` Pendentes: ${result.missing.join(', ')}.` : ''}{' '}
      <time dateTime={result.checkedAt}>Checagem: {new Date(result.checkedAt).toLocaleString('pt-BR')}.</time>
    </p>}
  </div>
}

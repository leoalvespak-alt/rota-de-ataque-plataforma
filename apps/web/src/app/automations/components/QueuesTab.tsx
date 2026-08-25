'use client'

import { useState } from 'react'
import { Button, EmptyState, StatusBadge } from '@plataforma/ui-bridge'
import { appPath } from '@/lib/base-path'
import type { WorkerInfo } from '../AutomationsClient'

export function QueuesTab({ workers }: { workers: WorkerInfo[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const queues = workers.filter((worker) => worker.bullmq)

  async function act(workerName: string, action: 'run_now' | 'clear_dlq') {
    setBusy(`${workerName}:${action}`)
    setMessage('')
    try {
      const response = await fetch(appPath('/api/admin/automations'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workerName, action }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Falha na operação de fila')
      setMessage(action === 'clear_dlq' ? `DLQ de ${workerName} limpa.` : `Execução de ${workerName} enfileirada.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha inesperada.')
    } finally {
      setBusy(null)
    }
  }

  if (queues.length === 0) return <EmptyState message="Nenhuma fila do BullMQ está disponível." />
  return <section className="bridge-section">
    {message && <p role="status" className="bridge-inline-notice">{message}</p>}
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Fila</th><th>Aguardando</th><th>Ativos</th><th>Falhos</th><th>Estado</th><th>Ações</th></tr></thead>
        <tbody>{queues.map((worker) => <tr key={worker.worker_name}>
          <td><code>{worker.worker_name}</code></td>
          <td>{worker.bullmq?.waiting ?? 0}</td>
          <td>{worker.bullmq?.active ?? 0}</td>
          <td>{worker.bullmq?.failed ?? 0}</td>
          <td><StatusBadge status={(worker.bullmq?.failed ?? 0) > 0 ? 'Erro' : 'Saudável'} /></td>
          <td><div className="bridge-action-group">
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void act(worker.worker_name, 'run_now')}>Executar agora</Button>
            <Button size="sm" variant="quiet" disabled={busy !== null || (worker.bullmq?.failed ?? 0) === 0} onClick={() => void act(worker.worker_name, 'clear_dlq')}>Limpar DLQ</Button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>
}

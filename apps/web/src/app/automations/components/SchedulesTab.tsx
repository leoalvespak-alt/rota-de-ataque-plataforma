'use client'

import { useState } from 'react'
import { Button, EmptyState, InputField, SelectField } from '@plataforma/ui-bridge'
import { CADENCE_PRESETS, parseCadenceLabel } from '@plataforma/shared/client'
import { appPath } from '@/lib/base-path'
import type { WorkerInfo } from '../AutomationsClient'

const CUSTOM = '__custom__'

function presetValue(cadence: string | null) {
  if (!cadence) return CADENCE_PRESETS[0]?.value ?? CUSTOM
  return CADENCE_PRESETS.some((preset) => preset.value === cadence) ? cadence : CUSTOM
}

function formatNext(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function SchedulesTab({ workers: initialWorkers }: { workers: WorkerInfo[] }) {
  const [workers, setWorkers] = useState(initialWorkers.filter((worker) => worker.schedulable))
  const [choice, setChoice] = useState<Record<string, string>>(() => Object.fromEntries(initialWorkers.map((worker) => [worker.worker_name, presetValue(worker.cadence)])))
  const [custom, setCustom] = useState<Record<string, string>>(() => Object.fromEntries(initialWorkers.map((worker) => [worker.worker_name, worker.cadence ?? ''])))
  const [preview, setPreview] = useState<Record<string, { cadence: string; next?: string; error?: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  function cadenceFor(worker: WorkerInfo) {
    const selected = choice[worker.worker_name] ?? presetValue(worker.cadence)
    return selected === CUSTOM ? custom[worker.worker_name] ?? '' : selected
  }

  async function previewCadence(worker: WorkerInfo, cadence = cadenceFor(worker)) {
    setBusy(`${worker.worker_name}:preview`)
    setPreview((current) => ({ ...current, [worker.worker_name]: { cadence } }))
    try {
      const response = await fetch(appPath('/api/admin/automations'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workerName: worker.worker_name, action: 'preview_schedule', cadence }),
      })
      const body = await response.json() as { nextExecution?: string; error?: string }
      if (!response.ok || !body.nextExecution) throw new Error(body.error ?? 'Cadência inválida.')
      setPreview((current) => ({ ...current, [worker.worker_name]: { cadence, next: body.nextExecution } }))
    } catch (error) {
      setPreview((current) => ({ ...current, [worker.worker_name]: { cadence, error: error instanceof Error ? error.message : 'Cadência inválida.' } }))
    } finally {
      setBusy(null)
    }
  }

  async function save(worker: WorkerInfo) {
    const cadence = cadenceFor(worker)
    const currentPreview = preview[worker.worker_name]
    if (!currentPreview?.next || currentPreview.cadence !== cadence) return
    setBusy(`${worker.worker_name}:save`)
    setMessage('')
    try {
      const response = await fetch(appPath('/api/admin/automations'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workerName: worker.worker_name, action: 'set_schedule', cadence }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Falha ao salvar agendamento')
      setWorkers((current) => current.map((item) => item.worker_name === worker.worker_name ? { ...item, cadence } : item))
      setMessage(`Cadência de ${worker.worker_name} atualizada.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha inesperada.')
    } finally {
      setBusy(null)
    }
  }

  if (workers.length === 0) return <EmptyState message="Nenhum worker agendável foi encontrado." />
  return <section className="bridge-section">
    {message && <p role="status" className="bridge-inline-notice">{message}</p>}
    <div style={{ overflowX: 'auto' }}><table>
      <thead><tr><th>Automação</th><th>Cadência atual</th><th>Nova cadência</th><th>Preview</th><th>Ação</th></tr></thead>
      <tbody>{workers.map((worker) => {
        const cadence = cadenceFor(worker)
        const workerPreview = preview[worker.worker_name]
        const isValidPreview = workerPreview?.cadence === cadence && Boolean(workerPreview.next)
        return <tr key={worker.worker_name}>
          <td><strong>{worker.label_pt ?? worker.worker_name}</strong><br /><code>{worker.worker_name}</code></td>
          <td>{worker.cadence ? parseCadenceLabel(worker.cadence) : 'Padrão do sistema'}</td>
          <td>
            <SelectField
              label={`Cadência de ${worker.worker_name}`}
              value={choice[worker.worker_name] ?? presetValue(worker.cadence)}
              onChange={(event) => {
                const value = event.target.value
                setChoice((current) => ({ ...current, [worker.worker_name]: value }))
                setPreview((current) => { const next = { ...current }; delete next[worker.worker_name]; return next })
                if (value !== CUSTOM) void previewCadence(worker, value)
              }}
            >
              {CADENCE_PRESETS.map((preset) => <option key={preset.id} value={preset.value}>{preset.label_pt}</option>)}
              <option value={CUSTOM}>Personalizado</option>
            </SelectField>
            {(choice[worker.worker_name] ?? presetValue(worker.cadence)) === CUSTOM && <InputField
              label="Expressão cron ou intervalo"
              value={custom[worker.worker_name] ?? ''}
              placeholder="0 */4 * * * ou every:900000"
              onChange={(event) => {
                setCustom((current) => ({ ...current, [worker.worker_name]: event.target.value }))
                setPreview((current) => { const next = { ...current }; delete next[worker.worker_name]; return next })
              }}
            />}
          </td>
          <td aria-live="polite">
            {workerPreview?.error && <span style={{ color: 'var(--status-error)' }}>{workerPreview.error}</span>}
            {isValidPreview && <span>Próxima execução: {formatNext(workerPreview.next!)}</span>}
            {!workerPreview && <Button size="sm" variant="secondary" disabled={!cadence || busy !== null} onClick={() => void previewCadence(worker)}>Visualizar</Button>}
          </td>
          <td><Button size="sm" variant="primary" disabled={busy !== null || !isValidPreview} onClick={() => void save(worker)}>Salvar</Button></td>
        </tr>
      })}</tbody>
    </table></div>
  </section>
}

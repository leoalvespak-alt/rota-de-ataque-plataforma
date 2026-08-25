import { MANAGED_SCHEDULER_CONFIG } from '@plataforma/queue'
import { AUTOMATION_ENGINES } from '@plataforma/shared'
import { describe, expect, it } from 'vitest'

describe('catálogo de motores e scheduler gerenciado', () => {
  it('cobre exatamente os nove workers agendáveis reais', () => {
    const catalogWorkers = new Set(AUTOMATION_ENGINES.flatMap((engine) => engine.workers))
    const schedulableWorkers = Object.keys(MANAGED_SCHEDULER_CONFIG).sort()

    expect(schedulableWorkers).toHaveLength(9)
    for (const workerName of schedulableWorkers) {
      expect(catalogWorkers.has(workerName as never)).toBe(true)
    }
  })
})

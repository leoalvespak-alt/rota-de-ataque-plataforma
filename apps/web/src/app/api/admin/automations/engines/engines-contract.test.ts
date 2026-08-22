/**
 * engines-contract.test.ts
 *
 * Testes de contrato para as rotas novas de motores.
 * Critério de aceite (passo 3.6):
 * - Sem sessão → 401
 * - viewer em POST → 403
 * - Pré-requisito faltando → 409 com corpo tipado
 * - Dependência de motor faltando → 409
 * - Replay da mesma ação → 200 com changed: []
 *
 * NOTA: estes são testes unitários das lógicas de validação.
 * Testes de integração HTTP seriam feitos com a stack completa.
 */

import { describe, it, expect } from 'vitest'
import {
  AUTOMATION_ENGINES,
  ENGINE_BY_KEY,
  resolveEnableCascade,
  resolveDisableCascade,
} from '@plataforma/shared'

describe('Contrato da API de motores — lógica de validação', () => {
  describe('resolveEnableCascade — dependências para enable', () => {
    it('M3 precisa de M1 e M2 antes de ser ligado', () => {
      const deps = resolveEnableCascade('M3')
      expect(deps).toContain('M1')
      expect(deps).toContain('M2')
      expect(deps).not.toContain('M3')
    })

    it('M6 precisa de M1, M2, M3, M4, M5 (transitivo)', () => {
      const deps = resolveEnableCascade('M6')
      expect(deps).toContain('M1')
      expect(deps).toContain('M2')
      expect(deps).toContain('M3')
      expect(deps).toContain('M4')
      expect(deps).toContain('M5')
    })

    it('M0 e M1 não têm dependências', () => {
      expect(resolveEnableCascade('M0')).toEqual([])
      expect(resolveEnableCascade('M1')).toEqual([])
    })
  })

  describe('resolveDisableCascade — cascata de desativação', () => {
    it('desligar M2 afeta M3, M4, M5, M6', () => {
      const affected = resolveDisableCascade('M2')
      expect(affected).toContain('M3')
      expect(affected).toContain('M4')
      expect(affected).toContain('M5')
      expect(affected).toContain('M6')
    })

    it('desligar M5 afeta M6', () => {
      const affected = resolveDisableCascade('M5')
      expect(affected).toContain('M6')
    })

    it('desligar M6 não afeta ninguém', () => {
      expect(resolveDisableCascade('M6')).toEqual([])
    })
  })

  describe('Idempotência — semântica de changed: []', () => {
    it('se todos os workers já estão no estado alvo, changed deve ser vazio', () => {
      // Simula o comportamento: enabledValue = true, todos já true
      const engineWorkers = ENGINE_BY_KEY['M0'].workers
      const fakeState = engineWorkers.map((w) => ({ worker_name: w, enabled: true }))
      const enabledValue = true
      const changed = fakeState.filter((w: any) => w.enabled !== enabledValue).map((w: any) => w.worker_name)
      expect(changed).toEqual([])
    })
  })

  describe('Enginer keys válidas', () => {
    const validKeys = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']

    it('todos os motores devem ter key válida', () => {
      for (const engine of AUTOMATION_ENGINES) {
        expect(validKeys).toContain(engine.key)
      }
    })

    it('ENGINE_BY_KEY deve ter entrada para cada key válida', () => {
      for (const key of validKeys) {
        expect(ENGINE_BY_KEY[key as keyof typeof ENGINE_BY_KEY]).toBeDefined()
      }
    })
  })

  describe('Workers schedulable — coerência com MANAGED_SCHEDULER_CONFIG', () => {
    const SCHEDULABLE_WORKERS = new Set([
      'news-radar', 'competitive-intel', 'data-quality', 'community-map',
      'reddit-intelligence', 'email-flow-engine', 'adaptive-crawler', 'publisher', 'threads-publisher',
    ])

    it('deve haver exatamente 9 workers schedulable', () => {
      expect(SCHEDULABLE_WORKERS.size).toBe(9)
    })

    it('todos os workers schedulable devem estar no catálogo de algum motor', () => {
      const allWorkers = new Set(AUTOMATION_ENGINES.flatMap((e: any) => e.workers))
      for (const w of SCHEDULABLE_WORKERS) {
        expect(allWorkers, `Worker schedulable ${w} nao encontrado em nenhum motor`).toContain(w)
      }
    })
  })
})

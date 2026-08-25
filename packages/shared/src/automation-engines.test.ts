/**
 * automation-engines.test.ts
 *
 * Testes de cobertura total do catálogo de motores.
 * CRITÉRIO DE ACEITE: todos os 41 workers cobertos exatamente uma vez nos 7 motores.
 * Este teste BLOQUEIA o merge se qualquer cobertura falhar.
 */

import { describe, it, expect } from 'vitest'
import { AUTOMATION_ENGINES, ENGINE_BY_KEY, hasDepCycle, resolveDisableCascade, resolveEnableCascade, parseCadenceLabel, CADENCE_PRESETS } from './automation-engines.js'
import workerInventory from './__fixtures__/worker-inventory.json' with { type: 'json' }
import { QUEUE_NAMES, type QueueName } from './index.js'

const ALL_QUEUE_NAMES: QueueName[] = workerInventory.workers as QueueName[]

describe('AUTOMATION_ENGINES — cobertura dos 41 workers', () => {
  const allWorkers = AUTOMATION_ENGINES.flatMap((e) => e.workers)

  it('deve ter exatamente 7 motores', () => {
    expect(AUTOMATION_ENGINES).toHaveLength(7)
  })

  it('deve ter exatamente 41 workers no total (sem sobra, sem falta)', () => {
    expect(allWorkers).toHaveLength(41)
  })

  it('deve respeitar a distribuição aprovada entre os 7 motores', () => {
    expect(Object.fromEntries(AUTOMATION_ENGINES.map((engine) => [engine.key, engine.workers.length]))).toEqual({
      M0: 2,
      M1: 12,
      M2: 8,
      M3: 2,
      M4: 2,
      M5: 11,
      M6: 4,
    })
  })

  it('nenhum worker deve estar duplicado entre motores', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const w of allWorkers) {
      if (seen.has(w)) duplicates.push(w)
      seen.add(w)
    }
    expect(duplicates).toEqual([])
  })

  it('todos os workers do inventário devem estar cobertos', () => {
    const covered = new Set(allWorkers)
    const missing = ALL_QUEUE_NAMES.filter((w) => !covered.has(w))
    expect(missing).toEqual([])
  })

  it('nenhum worker extra deve existir além dos do inventário', () => {
    const inventorySet = new Set(ALL_QUEUE_NAMES)
    const extra = allWorkers.filter((w) => !inventorySet.has(w))
    expect(extra).toEqual([])
  })

  it('inventário deve ter exatamente 41 entradas', () => {
    expect(ALL_QUEUE_NAMES).toHaveLength(41)
  })

  it('inventário congelado deve continuar idêntico a QUEUE_NAMES', () => {
    expect([...ALL_QUEUE_NAMES].sort()).toEqual([...QUEUE_NAMES].sort())
  })
})

describe('AUTOMATION_ENGINES — integridade do grafo', () => {
  it('todo dependsOn deve apontar para uma EngineKey existente', () => {
    const validKeys = new Set(AUTOMATION_ENGINES.map((e) => e.key))
    for (const engine of AUTOMATION_ENGINES) {
      for (const dep of engine.dependsOn) {
        expect(validKeys, `Motor ${engine.key} depende de chave inexistente: ${dep}`).toContain(dep)
      }
    }
  })

  it('grafo de dependências não deve ter ciclo', () => {
    expect(hasDepCycle()).toBe(false)
  })

  it('M0 deve ser always_on e sem dependências', () => {
    const m0 = ENGINE_BY_KEY['M0']
    expect(m0.alwaysOn).toBe(true)
    expect(m0.dependsOn).toHaveLength(0)
  })
})

describe('resolveEnableCascade', () => {
  it('M0 não tem dependências — cascade vazio', () => {
    expect(resolveEnableCascade('M0')).toEqual([])
  })

  it('M1 não tem dependências — cascade vazio', () => {
    expect(resolveEnableCascade('M1')).toEqual([])
  })

  it('M2 depende de M1 — cascade contém M1', () => {
    const result = resolveEnableCascade('M2')
    expect(result).toContain('M1')
    expect(result).not.toContain('M2')
  })

  it('M4 depende de M3 → M2 → M1 — cascade contém M1, M2, M3 em ordem', () => {
    const result = resolveEnableCascade('M4')
    expect(result).toContain('M1')
    expect(result).toContain('M2')
    expect(result).toContain('M3')
    expect(result).not.toContain('M4')
    // M1 deve aparecer antes de M2, M2 antes de M3
    expect(result.indexOf('M1')).toBeLessThan(result.indexOf('M2'))
    expect(result.indexOf('M2')).toBeLessThan(result.indexOf('M3'))
  })
})

describe('resolveDisableCascade', () => {
  it('M6 não tem dependentes — cascade vazio', () => {
    expect(resolveDisableCascade('M6')).toEqual([])
  })

  it('desligar M1 afeta M2 (que depende de M1)', () => {
    const result = resolveDisableCascade('M1')
    expect(result).toContain('M2')
  })

  it('desligar M1 afeta transitivamente M3, M4, M5, M6', () => {
    const result = resolveDisableCascade('M1')
    expect(result).toContain('M2')
    expect(result).toContain('M3')
    expect(result).toContain('M4')
    expect(result).toContain('M5')
    expect(result).toContain('M6')
  })

  it('desligar M0 não afeta outros motores (M0 não é dependência de ninguém)', () => {
    const result = resolveDisableCascade('M0')
    expect(result).toEqual([])
  })
})

describe('parseCadenceLabel', () => {
  it('deve retornar label_pt para um preset conhecido', () => {
    expect(parseCadenceLabel('every:900000')).toBe('A cada 15 minutos')
    expect(parseCadenceLabel('every:3600000')).toBe('A cada hora')
    expect(parseCadenceLabel('0 6 * * *')).toBe('Diariamente às 06:00')
  })

  it('deve converter every:N não mapeado para frase legível', () => {
    expect(parseCadenceLabel('every:120000')).toBe('A cada 2 min')
    expect(parseCadenceLabel('every:7200000')).toBe('A cada 2h')
  })

  it('deve identificar cron desconhecido como personalizado', () => {
    expect(parseCadenceLabel('30 8 * * 2')).toBe('Personalizado (cron): 30 8 * * 2')
  })

  it('todos os presets devem ser parseáveis de volta ao label_pt', () => {
    for (const preset of CADENCE_PRESETS) {
      expect(parseCadenceLabel(preset.value)).toBe(preset.label_pt)
    }
  })
})

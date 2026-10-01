import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAutoEvidence,
  isTrustedSource,
  loadJevAutoConfig,
  scoresPassGate,
  verifyFactualPreserved,
} from './jev-verifier.js'

describe('jev-verifier', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('loads calibrated defaults and stays disabled without an explicit flag', () => {
    const config = loadJevAutoConfig({} as NodeJS.ProcessEnv)
    expect(config).toMatchObject({
      enabled: false,
      minRelevance: 0.8,
      minConfidence: 0.8,
      minFactuality: 0.8,
      minPreserved: 0.8,
      model: '~typesafe/jev-latest',
    })
    expect(config.trustedSources).toContain('pci concursos')
  })

  it('matches trusted sources case-insensitively', () => {
    expect(isTrustedSource('PCI Concursos', ['pci concursos'])).toBe(true)
    expect(isTrustedSource('Folha Dirigida por Qconcursos', ['folha dirigida'])).toBe(true)
    expect(isTrustedSource('Blog desconhecido', ['pci concursos'])).toBe(false)
    expect(isTrustedSource(null, ['pci concursos'])).toBe(false)
  })

  it('requires every classifier score above its floor', () => {
    const config = loadJevAutoConfig({ RADAR_AUTO_CONTENT_ENABLED: 'true' } as NodeJS.ProcessEnv)
    expect(scoresPassGate({ relevance: 0.9, confidence: 0.9, factuality: 0.9 }, config)).toBe(true)
    expect(scoresPassGate({ relevance: 0.79, confidence: 0.9, factuality: 0.9 }, config)).toBe(false)
    expect(scoresPassGate({ relevance: 0.9, confidence: 0.9, factuality: 0.5 }, config)).toBe(false)
  })

  it('returns preserved probability from the JEV decisions API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: '~typesafe/jev-latest',
        answers: { trava_factual: { type: 'noul', noul: 0.12 } },
        usage: { cost: 0.000016, input_tokens: 380 },
      }),
    }))
    const check = await verifyFactualPreserved({
      title: 'Edital publicado', summary: 'Resumo', apiKey: 'key', model: '~typesafe/jev-latest', timeoutMs: 5000,
    })
    expect(check).toEqual({ preserved: 0.88, costUsd: 0.000016, model: '~typesafe/jev-latest', inputTokens: 380 })
  })

  it('fails closed when JEV errors or answers are malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    await expect(verifyFactualPreserved({
      title: 'T', summary: null, apiKey: 'key', model: 'm', timeoutMs: 5000,
    })).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answers: {} }) }))
    await expect(verifyFactualPreserved({
      title: 'T', summary: null, apiKey: 'key', model: 'm', timeoutMs: 5000,
    })).resolves.toBeNull()
    await expect(verifyFactualPreserved({
      title: 'T', summary: null, apiKey: '   ', model: 'm', timeoutMs: 5000,
    })).resolves.toBeNull()
  })

  it('builds auditable auto evidence', () => {
    const config = loadJevAutoConfig({ RADAR_AUTO_CONTENT_ENABLED: 'true' } as NodeJS.ProcessEnv)
    expect(buildAutoEvidence({ jevPreserved: 0.91, sourceName: 'PCI Concursos', config })).toMatchObject({
      jevPreserved: 0.91,
      trustedSource: 'pci concursos',
      minPreserved: 0.8,
    })
  })
})

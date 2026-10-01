import { describe, expect, it, vi } from 'vitest'
import type { SlotBrief } from '@plataforma/shared'
import { buildSlotPrompt, composeSlotDecision } from './slot-job.js'

const brief: SlotBrief = {
  findingId: '10000000-0000-4000-8000-000000000001',
  title: 'PMMG abre concurso com 90 vagas',
  summary: 'Edital da PMMG.',
  categoria: 'PM',
  channel: 'instagram',
  relevanceScore: 0.95,
  confidence: 0.9,
  factualityScore: 0.85,
  jevPreserved: 0.9,
}

const llmDecision = {
  findingId: brief.findingId,
  contentType: 'noticia',
  postType: 'carrossel',
  templateIds: ['CrCover', 'CrSlide'],
  slides: [{ role: 'cover', title: 'T', body: 'B' }],
  caption: 'Legenda',
  hashtags: ['#pmmg'],
  cta: 'CTA da BIO',
  scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
  priority: 'P0',
  reviewMode: 'imediato',
  rationale: 'JEV alto.',
}

describe('slot-job', () => {
  it('tells the model to avoid em dashes and embeds the matrix', () => {
    const prompt = buildSlotPrompt(brief)
    const [system, user] = prompt
    expect(system?.content).toContain('travessão')
    expect(user?.content).not.toContain('—')
    expect(system?.content).toContain('copy-matrix.v1')
    expect(user?.content).toContain('PMMG abre concurso')
  })

  it('composes a calibrated decision from valid LLM output', async () => {
    const chat = vi.fn().mockResolvedValue({ content: JSON.stringify(llmDecision), provider: 'primary' as const })
    const result = await composeSlotDecision(brief, {
      chat: chat as never,
      config: {
        primaryEndpoint: 'https://x', primaryModel: 'm', primaryApiKey: 'k',
        fallbackEndpoint: 'https://y', fallbackModel: 'n', fallbackApiKey: '',
        maxTokens: 10, timeoutMs: 1000,
      },
      now: () => new Date('2026-09-30T10:00:00Z'),
    })
    expect(result.ok).toBe(true)
    expect(result.decision).toMatchObject({ priority: 'P0', reviewMode: 'imediato', findingId: brief.findingId })
    expect(result.decision?.scheduledFor).toBe('2026-09-30T12:00:00.000Z')
    expect(chat).toHaveBeenCalledOnce()
  })

  it('fails closed on schema-invalid LLM output', async () => {
    const chat = vi.fn().mockResolvedValue({ content: '{"not":"a decision"}', provider: 'primary' as const })
    const result = await composeSlotDecision(brief, {
      chat: chat as never,
      config: {
        primaryEndpoint: 'https://x', primaryModel: 'm', primaryApiKey: 'k',
        fallbackEndpoint: 'https://y', fallbackModel: 'n', fallbackApiKey: '',
        maxTokens: 10, timeoutMs: 1000,
      },
    })
    expect(result).toEqual({ ok: false, error: 'slot_decision_invalid' })
  })

  it('fails closed without LLM configuration', async () => {
    const result = await composeSlotDecision(brief, { config: null, chat: vi.fn() as never })
    expect(result).toEqual({ ok: false, error: 'slot_llm_unconfigured' })
  })

  it('normalizes hashtags and recomputes system fields', async () => {
    const chat = vi.fn().mockResolvedValue({
      content: JSON.stringify({ ...llmDecision, hashtags: ['PMMG', '#Concursos Públicos!'] }),
      provider: 'primary' as const,
    })
    const result = await composeSlotDecision(brief, {
      chat: chat as never,
      config: {
        primaryEndpoint: 'https://x', primaryModel: 'm', primaryApiKey: 'k',
        fallbackEndpoint: 'https://y', fallbackModel: 'n', fallbackApiKey: '',
        maxTokens: 10, timeoutMs: 1000,
      },
    })
    expect(result.ok).toBe(true)
    expect(result.decision?.hashtags).toEqual(['#pmmg', '#concursospublicos'])
    expect(result.decision?.findingId).toBe(brief.findingId)
  })

  it('alias-maps invented enums and retries once on garbage', async () => {
    const invented = {
      contentType: 'edital',
      postType: 'feed_carousel',
      templateIds: ['capa_edital', 'CrSlide'],
      slides: [{ role: 'capa', title: 'T', body: 'B' }, { role: 'contexto', title: 'T2', body: 'B2' }],
      caption: 'Legenda',
      hashtags: [],
      cta: 'CTA',
      rationale: 'R',
    }
    const chat = vi.fn().mockResolvedValue({ content: JSON.stringify(invented), provider: 'primary' as const })
    const result = await composeSlotDecision(brief, {
      chat: chat as never,
      config: {
        primaryEndpoint: 'https://x', primaryModel: 'm', primaryApiKey: 'k',
        fallbackEndpoint: 'https://y', fallbackModel: 'n', fallbackApiKey: '',
        maxTokens: 10, timeoutMs: 1000,
      },
    })
    expect(result.ok).toBe(true)
    expect(result.decision).toMatchObject({
      contentType: 'noticia',
      postType: 'carrossel',
      templateIds: ['CrSlide'],
    })
    expect(result.decision?.slides.map((slide) => slide.role)).toEqual(['cover', 'content'])

    const garbage = vi.fn().mockResolvedValue({ content: 'not json at all', provider: 'primary' as const })
    const failed = await composeSlotDecision(brief, {
      chat: garbage as never,
      config: {
        primaryEndpoint: 'https://x', primaryModel: 'm', primaryApiKey: 'k',
        fallbackEndpoint: 'https://y', fallbackModel: 'n', fallbackApiKey: '',
        maxTokens: 10, timeoutMs: 1000,
      },
    })
    expect(failed).toEqual({ ok: false, error: 'slot_decision_invalid' })
    expect(garbage).toHaveBeenCalledTimes(2)
  })
})

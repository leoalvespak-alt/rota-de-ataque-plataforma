import { describe, expect, it } from 'vitest'
import { defaultPriorityFor, normalizeHashtag, slotBriefSchema, slotDecisionRawSchema, slotDecisionSchema } from './slot-pipeline.js'

describe('slot-pipeline contracts', () => {
  it('accepts a minimal slot brief', () => {
    const parsed = slotBriefSchema.safeParse({
      findingId: '10000000-0000-4000-8000-000000000001',
      title: 'PMMG abre concurso com 90 vagas',
      categoria: 'PM',
      relevanceScore: 0.95,
      confidence: 0.9,
      factualityScore: 0.85,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.channel).toBe('instagram')
  })

  it('rejects decisions without templates or with bad hashtags', () => {
    const base = {
      findingId: '10000000-0000-4000-8000-000000000001',
      contentType: 'noticia',
      postType: 'carrossel',
      templateIds: ['CrCover'],
      slides: [{ role: 'cover', title: 'T', body: 'B' }],
      caption: 'Legenda',
      hashtags: ['#pmmg'],
      cta: 'CTA',
      scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
      priority: 'P0',
      reviewMode: 'imediato',
      rationale: 'JEV alto.',
    } as const
    expect(slotDecisionSchema.safeParse(base).success).toBe(true)
    expect(slotDecisionSchema.safeParse({ ...base, templateIds: [] }).success).toBe(false)
    expect(slotDecisionSchema.safeParse({ ...base, hashtags: ['sem-hash'] }).success).toBe(false)
  })

  it('prioritizes JEV-approved news immediately and tips last', () => {
    expect(defaultPriorityFor({ jevPreserved: 0.9, contentType: 'noticia' })).toEqual({ priority: 'P0', reviewMode: 'imediato' })
    expect(defaultPriorityFor({ jevPreserved: 0.5, contentType: 'noticia' })).toEqual({ priority: 'P1', reviewMode: 'fila' })
    expect(defaultPriorityFor({ jevPreserved: null, contentType: 'educativo' })).toEqual({ priority: 'P3', reviewMode: 'rigoroso' })
  })

  it('accepts raw LLM output without system fields and normalizes hashtags', () => {
    const raw = {
      contentType: 'noticia',
      postType: 'estatico',
      templateIds: ['SqCover'],
      slides: [{ role: 'cover', title: 'T', body: 'B' }],
      caption: 'Legenda',
      hashtags: ['Qualquer coisa'],
      cta: 'CTA',
      rationale: 'R',
    }
    expect(slotDecisionRawSchema.safeParse(raw).success).toBe(true)
    expect(normalizeHashtag('#PMMG')).toBe('#pmmg')
    expect(normalizeHashtag('Concursos Públicos!')).toBe('#concursospublicos')
    expect(normalizeHashtag('#')).toBeNull()
  })
})

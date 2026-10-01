import { describe, expect, it } from 'vitest'
import { canonicalPautaKey, normalizePautaTitle, PAUTA_BLOCKING_STATUSES } from './pauta-key.js'

describe('pauta-key', () => {
  it('normalizes titles across sources', () => {
    expect(normalizePautaTitle('PMMG abre concurso com 90 vagas!')).toBe('pmmg abre concurso com 90 vagas')
    expect(normalizePautaTitle('  PMMG   ABRE concurso: 90 VAGAS ')).toBe('pmmg abre concurso 90 vagas')
  })

  it('produces the same key for the same news from different sources', () => {
    const a = canonicalPautaKey({ categoria: 'PM', estado: 'MG', fase_ciclo: 'edital_publicado', title: 'PMMG abre concurso com 90 vagas!' })
    const b = canonicalPautaKey({ categoria: 'pm', estado: 'mg', fase_ciclo: 'edital_publicado', title: 'Pmmg abre concurso com 90 vagas' })
    expect(a).toBe(b)
    expect(a).toBe('pm|MG|edital_publicado|pmmg abre concurso com 90 vagas')
  })

  it('separates different phases of the same contest', () => {
    const edital = canonicalPautaKey({ categoria: 'PM', estado: 'MG', fase_ciclo: 'edital_publicado', title: 'PMMG 90 vagas' })
    const resultado = canonicalPautaKey({ categoria: 'PM', estado: 'MG', fase_ciclo: 'resultado', title: 'PMMG 90 vagas' })
    expect(edital).not.toBe(resultado)
  })

  it('blocks reposting for posted, scheduled and manual statuses', () => {
    expect([...PAUTA_BLOCKING_STATUSES]).toEqual(['posted', 'scheduled', 'manual'])
  })
})

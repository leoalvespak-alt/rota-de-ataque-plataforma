import { describe, expect, it } from 'vitest'
import { getTemplateContract } from './templateContracts'
import { validateCards } from './validation'
import { previewConversion } from './multiformat'
import { sanitizeFilename } from './exportJobs'
import { transitionWorkflow } from './workflow'
import type { CardDocument } from './documents'

const card: CardDocument = {
  id: 'card-1', templateId: 'sq-cover', elements: { eyebrow: 'TESTE', title: 'TÍTULO', subtitle: 'Texto', redline: true }, darkMode: false,
  decor: { texture: { type: 'none', opacity: 0 }, watermark: { visible: false, text: '', position: 'bottom-right', opacity: 0 }, bgLibraryId: 'none' },
}

describe('domain contracts', () => {
  it('expõe contratos seguros para todos os 26 templates', () => {
    expect(getTemplateContract('sq-cover')?.fieldSchema.fields.map((field) => field.name)).toContain('title')
    expect(getTemplateContract('cr-cta')?.variants).toHaveLength(1)
  })

  it('bloqueia campo obrigatório ausente antes de uma mutação', () => {
    const result = validateCards([{ ...card, elements: { ...card.elements, title: '' } }])
    expect(result.valid).toBe(false)
    expect(result.issues[0]?.field).toBe('title')
  })

  it('não converte formatos sem equivalência aprovada', () => {
    expect(previewConversion(card, 'portrait')).toMatchObject({ valid: false })
  })

  it('sanitiza nomes de exportação e protege transições de workflow', () => {
    expect(sanitizeFilename('relatório: julho/2026')).toBe('relatório- julho-2026')
    expect(() => transitionWorkflow('draft', 'published', 'Usuário local')).toThrow('Transição inválida')
  })
})

import { describe, it, expect } from 'vitest'
import {
  validateTemplateMetadata,
  safeValidateTemplateMetadata,
  slotDefinitionSchema,
} from './schemas'

describe('Template Schemas', () => {
  it('validates a minimal template metadata', () => {
    const data = {
      id: 'sq-cover',
      name: 'Cover Quadrado',
      category: 'cover',
      filter: 'square',
      format: 'square',
      tags: ['fiscal'],
    }
    const result = validateTemplateMetadata(data)
    expect(result.id).toBe('sq-cover')
    expect(result.format).toBe('square')
  })

  it('validates template with slots', () => {
    const data = {
      id: 'sq-text-image',
      name: 'Texto + Imagem',
      category: 'content',
      filter: 'square',
      format: 'square',
      tags: ['fiscal', 'policial'],
      slots: [
        { id: 'title', type: 'text', label: 'Titulo', required: true, editable: true },
        { id: 'image', type: 'image', label: 'Imagem', required: false },
      ],
    }
    const result = validateTemplateMetadata(data)
    expect(result.slots).toHaveLength(2)
  })

  it('rejects invalid format', () => {
    const data = {
      id: 'test',
      name: 'Test',
      category: 'test',
      filter: 'invalid',
      format: 'square',
      tags: [],
    }
    const result = safeValidateTemplateMetadata(data)
    expect(result.success).toBe(false)
  })

  it('validates slot definition', () => {
    const slot = {
      id: 'title',
      type: 'text' as const,
      label: 'Titulo',
      required: true,
      editable: true,
      constraints: { maxWidth: 800 },
    }
    const result = slotDefinitionSchema.parse(slot)
    expect(result.id).toBe('title')
    expect(result.constraints?.maxWidth).toBe(800)
  })

  it('validates template with quality rules', () => {
    const data = {
      id: 'sq-cover',
      name: 'Cover',
      category: 'cover',
      filter: 'square',
      format: 'square',
      tags: [],
      qualityRules: [
        { id: 'title-required', severity: 'error', check: 'required', field: 'title', params: {} },
        { id: 'title-max', severity: 'warning', check: 'max-length', field: 'title', params: { max: 60 } },
      ],
    }
    const result = validateTemplateMetadata(data)
    expect(result.qualityRules).toHaveLength(2)
  })
})

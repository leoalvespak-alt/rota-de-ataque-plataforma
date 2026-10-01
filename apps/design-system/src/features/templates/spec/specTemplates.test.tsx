import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../registry'
import { NEW_SPEC_DEFINITIONS, NEW_SPEC_TEMPLATES } from './specTemplates'
import type { SpecElements } from './SpecComposition'

describe('spec editorial compositions', () => {
  it('registra 24 composições distintas junto aos 26 IDs legados', () => {
    const ids = TEMPLATES.map((template) => template.id)
    expect(NEW_SPEC_DEFINITIONS).toHaveLength(24)
    expect(NEW_SPEC_TEMPLATES).toHaveLength(24)
    expect(new Set(ids).size).toBe(50)
    expect(TEMPLATES).toHaveLength(50)
    expect(NEW_SPEC_DEFINITIONS.every((spec) => ids.includes(spec.id))).toBe(true)
  })

  it('usa feed 4:5 em posts e carrosséis e Story 9:16 nas seis telas verticais', () => {
    for (const template of NEW_SPEC_TEMPLATES) {
      const isStory = template.id.startsWith('story-')
      expect(template.format).toBe(isStory ? 'portrait' : 'feed')
      expect(template.filter).toBe(template.id.startsWith('carousel-') ? 'carousel' : isStory ? 'portrait' : 'square')
      expect(template.fieldSchema?.fields.some((field) => field.name === 'proofImage' && field.type === 'image')).toBe(true)
    }
  })

  it('renderiza composições distintas com placeholders e sem alegações preenchidas', () => {
    const renderings = new Set<string>()
    for (const template of NEW_SPEC_TEMPLATES) {
      const html = renderToStaticMarkup(
        createElement(template.Render, { elements: template.defaults as SpecElements, dark: false }),
      )
      renderings.add(html)
      expect(html).toContain('<div')
      expect(html).not.toContain('undefined')
      expect(template.defaults.title).toContain('Título da ideia')
      expect(template.defaults.source).toContain('Fonte, versão e trecho')
    }
    expect(renderings.size).toBe(24)
  })
})

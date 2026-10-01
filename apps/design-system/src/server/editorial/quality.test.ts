import { describe, expect, it } from 'vitest'
import { evaluateQuality } from './quality'
import { rewriteIfNeeded } from './pipeline'

describe('editorial quality gates', () => {
  it('does not invent a factual-grounding score without claim-level verification', () => {
    const score = evaluateQuality({ text: 'Uma explicação didática com critérios claros para revisar o conteúdo.', coreStatement: 'revisar conteúdo com critérios', format: 'post' })
    expect(score.factualGrounding).toBeNull()
  })

  it('keeps revision notes out of publishable copy', () => {
    const result = rewriteIfNeeded({ text: 'Rascunho editorial.' }, { overall: 0.2 }, 'Conferir a fonte antes da aprovação.')
    expect(result.text).toBe('Rascunho editorial.')
    expect(result).toMatchObject({ needsRevision: true, revisionReason: 'Conferir a fonte antes da aprovação.' })
  })
})

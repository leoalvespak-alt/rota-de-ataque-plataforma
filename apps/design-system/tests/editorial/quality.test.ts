import { describe, expect, it } from 'vitest'
import { evaluateQuality } from '@/server/editorial/quality'
describe('quality', () => { it('reduz qualidade para palavra proibida', () => { const score = evaluateQuality({ text: 'Este argumento tem spam e exemplos práticos 2026.', coreStatement: 'argumento prático', forbiddenWords: ['spam'], format: 'post', hook: 'Um hook claro para agir agora' }); expect(score.voiceConsistency).toBe(0); expect(score.overall).toBeLessThan(.8) }) })

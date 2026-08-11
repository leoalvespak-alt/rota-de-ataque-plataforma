import { describe, expect, it } from 'vitest'
import { createThesisSchema } from '@/domain/editorial/schemas'
describe('editorial schemas', () => { it('normaliza peso para o driver numeric', () => { const parsed = createThesisSchema.parse({ title: 'Tese válida', coreStatement: 'Uma afirmação central suficientemente longa.', weight: 2 }); expect(parsed.weight).toBe('2') }); it('rejeita título curto', () => expect(() => createThesisSchema.parse({ title: 'x', coreStatement: 'Uma afirmação central suficientemente longa.' })).toThrow()) })

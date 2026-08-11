import { describe, expect, it } from 'vitest'
import { fitContentToTemplate } from '@/server/editorial/content-fit'
describe('content fit', () => { it('sinaliza reescrita quando não há corte seguro', () => expect(fitContentToTemplate('x'.repeat(200), 50).action).toBe('rewrite')); it('mantém conteúdo que cabe', () => expect(fitContentToTemplate('curto', 50).fits).toBe(true)) })

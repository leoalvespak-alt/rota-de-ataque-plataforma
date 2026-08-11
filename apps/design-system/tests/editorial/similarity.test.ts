import { describe, expect, it } from 'vitest'
import { compareContent, cosineSimilarity } from '@/server/editorial/similarity'
describe('similarity', () => { it('detecta cópia idêntica', () => expect(compareContent({ text: 'A tese precisa de argumentos claros' }, { text: 'A tese precisa de argumentos claros' }).decision).toBe('block')); it('calcula cosseno', () => expect(cosineSimilarity([1, 0], [1, 0])).toBe(1)) })

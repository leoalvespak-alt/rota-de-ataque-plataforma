import { describe,expect,it } from 'vitest'; import { cheapFilter,cosine } from './index.js';
describe('nlp',()=>{it('filters cheap noise',()=>{expect(cheapFilter('👍')).toBe(true);expect(cheapFilter('Qual material você recomenda?')).toBe(false)});it('computes cosine',()=>expect(cosine([1,0],[1,0])).toBe(1))})

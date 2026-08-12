// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

async function sourceFiles(directory:string):Promise<string[]>{const entries=await readdir(directory,{withFileTypes:true});const nested=await Promise.all(entries.map(entry=>{const full=path.join(directory,entry.name);if(entry.isDirectory())return sourceFiles(full);return /\.(ts|tsx)$/.test(entry.name)&&!entry.name.includes('.stories.')&&!entry.name.includes('.test.')?[full]:[]}));return nested.flat()}

describe('production UI guardrails',()=>{
 it('does not ship fixtures, mock labels or operator-facing UUID/JSON forms',async()=>{const root=path.resolve(import.meta.dirname),files=await sourceFiles(root);const forbidden=[/sampleLeads\s*:/,/Campaign UUID/,/Conversation UUID/,/Steps JSON/,/events=\{\[\]\}/,/FeaturePage/,/MultichannelActions/,/from ['"]@faker-js\/faker['"]/,/import.*faker/,/mockData/,/dummy/,/Lorem ipsum/];for(const file of files){const source=await readFile(file,'utf8');for(const pattern of forbidden)expect(source,`${path.relative(root,file)} contains ${pattern}`).not.toMatch(pattern)}})
 it('keeps visible buttons wired or explicitly disabled',async()=>{const root=path.resolve(import.meta.dirname),files=await sourceFiles(path.join(root,'app'));for(const file of files){const source=await readFile(file,'utf8');const inert=[...source.matchAll(/<button(?<attrs>[^>]*)>/g)].filter(match=>{const attrs=match.groups?.attrs??'';return !/(onClick|type=["']submit["']|disabled|href)/.test(attrs)&&!/<form[\s\S]*<button/.test(source)});expect(inert.map(match=>match[0]),`${path.relative(root,file)} has possibly inert buttons`).toEqual([])}})
 it('does not contain empty links or hardcoded /prospector paths', async () => { const root=path.resolve(import.meta.dirname),files=await sourceFiles(path.join(root,'app')); for(const file of files){ const source=await readFile(file,'utf8'); expect(source, `${path.relative(root,file)} has empty link`).not.toMatch(/href=["'](#|)["']/); expect(source, `${path.relative(root,file)} has hardcoded /prospector path`).not.toMatch(/['"]\/prospector\//); } })
 it('ensures tabs have observable state effects', async () => { const root=path.resolve(import.meta.dirname),files=await sourceFiles(path.join(root,'app')); for(const file of files){ const source=await readFile(file,'utf8'); const tabs = [...source.matchAll(/<Tabs(?<attrs>[^>]*)>/g)].filter(match => { const attrs=match.groups?.attrs??''; return !/(value|onValueChange|defaultValue)/.test(attrs); }); expect(tabs.map(match=>match[0]), `${path.relative(root,file)} has inert tabs`).toEqual([]); } })
})

// Nota: O smoke test E2E de navegação de rotas autenticadas e validação 4xx/5xx deve ser implementado via Playwright em 'tests/e2e/smoke.spec.ts' já que requer um browser real e backend em execução.

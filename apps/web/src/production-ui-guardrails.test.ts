// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

async function sourceFiles(directory:string):Promise<string[]>{const entries=await readdir(directory,{withFileTypes:true});const nested=await Promise.all(entries.map(entry=>{const full=path.join(directory,entry.name);if(entry.isDirectory())return sourceFiles(full);return /\.(ts|tsx)$/.test(entry.name)&&!entry.name.includes('.stories.')&&!entry.name.includes('.test.')?[full]:[]}));return nested.flat()}

describe('production UI guardrails',()=>{
 const root=path.resolve(import.meta.dirname);let files:Array<{path:string;source:string}>=[],appFiles:Array<{path:string;source:string}>=[]
 beforeAll(async()=>{const paths=await sourceFiles(root);files=await Promise.all(paths.map(async file=>({path:file,source:await readFile(file,'utf8')})));appFiles=files.filter(file=>file.path.startsWith(path.join(root,'app')))})
 it('does not ship fixtures, mock labels or operator-facing UUID/JSON forms',()=>{const forbidden=[/sampleLeads\s*:/,/Campaign UUID/,/Conversation UUID/,/Steps JSON/,/events=\{\[\]\}/,/FeaturePage/,/MultichannelActions/,/from ['"]@faker-js\/faker['"]/,/import.*faker/,/mockData/,/dummy/,/Lorem ipsum/];for(const file of files)for(const pattern of forbidden)expect(file.source,`${path.relative(root,file.path)} contains ${pattern}`).not.toMatch(pattern)})
 it('keeps visible buttons wired or explicitly disabled',()=>{for(const file of appFiles){const inert=[...file.source.matchAll(/<button(?<attrs>[^>]*)>/g)].filter(match=>{const attrs=match.groups?.attrs??'';return !/(onClick|type=["']submit["']|disabled|href)/.test(attrs)&&!/<form[\s\S]*<button/.test(file.source)});expect(inert.map(match=>match[0]),`${path.relative(root,file.path)} has possibly inert buttons`).toEqual([])}})
 it('does not contain empty links or hardcoded /prospector paths',()=>{for(const file of appFiles){expect(file.source,`${path.relative(root,file.path)} has empty link`).not.toMatch(/href=["'](#|)["']/);expect(file.source,`${path.relative(root,file.path)} has hardcoded /prospector path`).not.toMatch(/['"]\/prospector\//)}})
 it('ensures tabs have observable state effects',()=>{for(const file of appFiles){const tabs=[...file.source.matchAll(/<Tabs(?<attrs>[^>]*)>/g)].filter(match=>{const attrs=match.groups?.attrs??'';return !/(value|onValueChange|defaultValue)/.test(attrs)});expect(tabs.map(match=>match[0]),`${path.relative(root,file.path)} has inert tabs`).toEqual([])}})

 it('does not use appPath() in router.push/replace — use bare path instead',()=>{
  const forbidden=[/router\.push\(appPath\(/,/router\.replace\(appPath\(/]
  for(const file of appFiles)for(const pattern of forbidden)expect(file.source,`${path.relative(root,file.path)} uses appPath() in router navigation — pass the path without basePath`).not.toMatch(pattern)
 })

 it('does not use @ts-nocheck in production code',()=>{
  for(const file of files){
   expect(file.source,`${path.relative(root,file.path)} uses @ts-nocheck`).not.toMatch(/\/\/\s*@ts-nocheck/)
  }
 })

 it('passes option (singular) to ChartContainer, not options',()=>{
  for(const file of files){
   const bad=[...file.source.matchAll(/<ChartContainer\s[^>]*options=/g)]
   expect(bad.map(m=>m[0]),`${path.relative(root,file.path)} passes 'options=' to ChartContainer instead of 'option='`).toEqual([])
  }
 })

 it('API routes referenced in fetch calls must have a route.ts file',async()=>{
  const routePattern=/appPath\(['"]\/api\/([^'"?]+)['"]\)/g
  const referencedRoutes=new Set<string>()
  for(const file of appFiles){
   for(const match of file.source.matchAll(routePattern)){
    referencedRoutes.add(match[1]!)
   }
  }
  for(const route of referencedRoutes){
   const segments=route.split('/')
   const candidates=[
    path.join(root,'app','api',...segments,'route.ts'),
   ]
   // Handle dynamic segments — try [param] variants for the last segment
   if(segments.length>=2){
    const parent=segments.slice(0,-1)
    candidates.push(path.join(root,'app','api',...parent,`[${segments.at(-1)}]`,'route.ts'))
    // Also check [id]/action patterns
    candidates.push(path.join(root,'app','api',...parent.slice(0,-1),`[${parent.at(-1)}]`,segments.at(-1)!,'route.ts'))
   }
   const exists=await Promise.all(candidates.map(c=>readFile(c).then(()=>true).catch(()=>false)))
   expect(exists.some(Boolean),`API route /api/${route} is referenced in code but no route.ts exists at any of: ${candidates.map(c=>path.relative(root,c)).join(', ')}`).toBe(true)
  }
 })
})

// Nota: O smoke test E2E de navegação de rotas autenticadas e validação 4xx/5xx deve ser implementado via Playwright em 'tests/e2e/smoke.spec.ts' já que requer um browser real e backend em execução.

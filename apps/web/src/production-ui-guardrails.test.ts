// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

async function sourceFiles(directory:string):Promise<string[]>{const entries=await readdir(directory,{withFileTypes:true});const nested=await Promise.all(entries.map(entry=>{const full=path.join(directory,entry.name);if(entry.isDirectory())return sourceFiles(full);return /\.(ts|tsx)$/.test(entry.name)&&!entry.name.includes('.stories.')&&!entry.name.includes('.test.')?[full]:[]}));return nested.flat()}

describe('production UI guardrails',()=>{
 it('does not ship fixtures, mock labels or operator-facing UUID/JSON forms',async()=>{const root=path.resolve(import.meta.dirname),files=await sourceFiles(root);const forbidden=[/sampleLeads\s*:/,/Campaign UUID/,/Conversation UUID/,/Steps JSON/,/events=\{\[\]\}/,/FeaturePage/,/MultichannelActions/];for(const file of files){const source=await readFile(file,'utf8');for(const pattern of forbidden)expect(source,`${path.relative(root,file)} contains ${pattern}`).not.toMatch(pattern)}})
 it('keeps visible buttons wired or explicitly disabled',async()=>{const root=path.resolve(import.meta.dirname),files=await sourceFiles(path.join(root,'app'));for(const file of files){const source=await readFile(file,'utf8');const inert=[...source.matchAll(/<button(?<attrs>[^>]*)>/g)].filter(match=>{const attrs=match.groups?.attrs??'';return !/(onClick|type=["']submit["']|disabled)/.test(attrs)&&!/<form[\s\S]*<button/.test(source)});expect(inert.map(match=>match[0]),`${path.relative(root,file)} has possibly inert buttons`).toEqual([])}})
})

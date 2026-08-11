import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const app = path.resolve(import.meta.dirname, '../apps/design-system')
const pkg = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'))
const allowed = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
const builtins = new Set(['node:assert', 'node:buffer', 'node:crypto', 'node:fs', 'node:path', 'node:url', 'node:util'])
const misses = new Set()

async function walk(directory) {
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name)
    const info = await stat(absolute)
    if (info.isDirectory()) await walk(absolute)
    else if (/\.[cm]?[jt]sx?$/.test(name) && !/\.(?:stories|test|spec)\.[cm]?[jt]sx?$/.test(name)) {
      const source = await readFile(absolute, 'utf8')
      for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]([^./@][^'"]*|@[^/'"]+\/[^/'"]+)["']/g)) {
        const specifier = match[1]
        const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
        if (!allowed.has(packageName) && !builtins.has(specifier)) misses.add(`${path.relative(app, absolute)} -> ${packageName}`)
      }
    }
  }
}

await walk(path.join(app, 'src'))
if (misses.size) {
  console.error([...misses].sort().join('\n'))
  process.exit(1)
}
console.log('Dependências de runtime declaradas corretamente.')

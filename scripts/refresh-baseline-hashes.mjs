import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const baselinePath = path.join(root, 'baseline/hashes.json')
const baseline = JSON.parse((await readFile(baselinePath, 'utf8')).replace(/^\uFEFF/, ''))
const app = path.join(root, 'apps/design-system')

for (const relative of Object.keys(baseline.files)) {
  const raw = await readFile(path.join(app, relative), 'utf8')
  const normalized = Buffer.from(raw.replace(/\r\n/g, '\n'))
  baseline.files[relative] = createHash('sha256').update(normalized).digest('hex')
}
baseline.generated_at = new Date().toISOString()
await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + '\n')
console.log(`Baseline atualizado: ${Object.keys(baseline.files).length} arquivos.`)

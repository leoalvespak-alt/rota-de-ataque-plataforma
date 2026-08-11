import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const baseline = JSON.parse((await readFile(path.join(root, 'baseline/hashes.json'), 'utf8')).replace(/^\uFEFF/, ''))
const app = path.join(root, 'apps/design-system')
const failures = []

for (const [relative, expected] of Object.entries(baseline.files)) {
  const actual = createHash('sha256').update(await readFile(path.join(app, relative))).digest('hex')
  if (actual !== expected) failures.push({ relative, expected, actual })
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}
console.log(`Baseline preservado: ${Object.keys(baseline.files).length} arquivos idênticos.`)

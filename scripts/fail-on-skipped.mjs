import { readFile } from 'node:fs/promises'
const report = JSON.parse(await readFile(process.argv[2], 'utf8'))
const skipped = (report.suites ?? []).flatMap((suite) => suite.specs ?? []).filter((spec) => spec.ok === false || spec.tests?.some((test) => test.status === 'skipped'))
if (skipped.length) {
  console.error(`${skipped.length} teste(s) skipped.`)
  process.exit(1)
}

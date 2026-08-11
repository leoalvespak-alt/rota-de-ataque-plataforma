import { execFileSync } from 'node:child_process'

const secretPattern = /(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)\s*=\s*(?!\s*(?:$|#|false\s*(?:#.*)?$|true\s*(?:#.*)?$))["']?[^\s"']+/im
const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' }).split(/\r?\n/).filter((file) => /(^|\/)\.env(?:\.|$)/.test(file))
const violations = []
for (const file of files) {
  const content = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' })
  if (!file.endsWith('.example')) violations.push(`${file}: arquivos de ambiente reais não podem ser versionados`)
  for (const line of content.split(/\r?\n/)) if (secretPattern.test(line)) violations.push(`${file}: valor sensível preenchido`)
}
if (violations.length) { console.error('Commit bloqueado por política de segredos:\n' + violations.join('\n')); process.exit(1) }

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeWorkspace } from './check-runtime-deps.mjs'

const temporaryDirectories = []

async function fixtureWorkspace({ importerPackage = {}, importerSource = '', sharedExports = { '.': './src/index.ts', './worker': './src/worker.ts' }, sharedSource = 'export const value = 1' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-deps-'))
  temporaryDirectories.push(root)
  await mkdir(path.join(root, 'packages', 'importer', 'src'), { recursive: true })
  await mkdir(path.join(root, 'packages', 'shared', 'src'), { recursive: true })
  await writeFile(path.join(root, 'packages', 'importer', 'package.json'), JSON.stringify({ name: '@fixture/importer', version: '1.0.0', ...importerPackage }))
  await writeFile(path.join(root, 'packages', 'importer', 'src', 'index.ts'), importerSource)
  await writeFile(path.join(root, 'packages', 'shared', 'package.json'), JSON.stringify({ name: '@fixture/shared', version: '1.0.0', exports: sharedExports }))
  await writeFile(path.join(root, 'packages', 'shared', 'src', 'index.ts'), sharedSource)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('check-runtime-deps', () => {
  it('identifies missing external runtime dependencies with importer context', async () => {
    const root = await fixtureWorkspace({ importerSource: "import missing from 'missing-package'\nexport default missing" })
    const findings = await analyzeWorkspace(root)

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ importer: '@fixture/importer', packageName: 'missing-package', kind: 'missing-runtime-dependency' }),
    ]))
  })

  it('identifies a missing workspace dependency instead of relying on hoisting', async () => {
    const root = await fixtureWorkspace({ importerSource: "import { value } from '@fixture/shared'\nexport { value }" })
    const findings = await analyzeWorkspace(root)

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ importer: '@fixture/importer', packageName: '@fixture/shared', kind: 'missing-runtime-dependency' }),
    ]))
  })

  it('accepts builtins and valid runtime/workspace dependencies', async () => {
    const root = await fixtureWorkspace({
      importerPackage: { dependencies: { '@fixture/shared': 'workspace:*', valid: '1.0.0' }, devDependencies: { vitest: '1.0.0' } },
      importerSource: "import 'node:fs'\nimport { strict } from 'assert'\nimport { value } from '@fixture/shared/worker'\nimport valid from 'valid'\nexport { value, valid, strict }",
    })
    await mkdir(path.join(root, 'packages', 'importer', 'src', '__tests__'), { recursive: true })
    await writeFile(path.join(root, 'packages', 'importer', 'src', '__tests__', 'valid.test.ts'), "import { describe } from 'vitest'\ndescribe('valid', () => undefined)")
    const findings = await analyzeWorkspace(root)

    expect(findings).toEqual([])
  })

  it('does not treat a type-only import from a dev dependency as runtime code', async () => {
    const root = await fixtureWorkspace({
      importerPackage: { devDependencies: { 'type-contract': '1.0.0' } },
      importerSource: "import type { Contract } from 'type-contract'\nexport const value: Contract | null = null",
    })
    const findings = await analyzeWorkspace(root)

    expect(findings).toEqual([])
  })

  it('distinguishes a missing test dependency and an unexported workspace subpath', async () => {
    const root = await fixtureWorkspace({
      importerPackage: { dependencies: { '@fixture/shared': 'workspace:*' } },
      importerSource: "import { value } from '@fixture/shared/private'\nimport { test } from 'test-only-package'\nexport { value, test }",
    })
    await mkdir(path.join(root, 'packages', 'importer', 'src', '__tests__'), { recursive: true })
    await writeFile(path.join(root, 'packages', 'importer', 'src', '__tests__', 'missing.test.ts'), "import { test } from 'test-only-package'\nvoid test")
    const findings = await analyzeWorkspace(root)

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unexported-workspace-subpath', specifier: '@fixture/shared/private' }),
      expect.objectContaining({ kind: 'missing-runtime-dependency', specifier: 'test-only-package' }),
      expect.objectContaining({ kind: 'missing-test-dependency', file: expect.stringContaining('__tests__') }),
    ]))
  })
})

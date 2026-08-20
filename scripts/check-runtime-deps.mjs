import { builtinModules } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const workspaceGroups = ['apps', 'packages', 'workers']
const sourceExtensions = /\.[cm]?[jt]sx?$/u
const testFile = /(?:\.(?:stories|test|spec)\.[cm]?[jt]sx?|(?:^|[\\/])(?:__tests__|fixtures|stories|test|tests)(?:[\\/]|$))/u
const excludedDirectories = new Set(['.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules', 'playwright-report', 'test-results'])
const builtinNames = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]))

function packageNameFromSpecifier(specifier) {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
}

function isBuiltin(specifier) {
  return specifier.startsWith('node:') || builtinNames.has(specifier)
}

function importsFromSource(source) {
  const imports = []
  const patterns = [
    /\bimport\s+(type\s+)?(?:(?:[^'";\n]|\n)*?\sfrom\s+)?['"]([^'"]+)['"]/gu,
    /\bexport\s+(type\s+)?(?:(?:[^'";\n]|\n)*?\sfrom\s+)?['"]([^'"]+)['"]/gu,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const dynamicImport = pattern.source.includes('require')
      const specifier = dynamicImport ? match[1] : match[2]
      if (!specifier) continue
      imports.push({ specifier, typeOnly: !dynamicImport && Boolean(match[1]) })
    }
  }
  return imports
}

async function readPackage(packageDirectory) {
  const packageJsonPath = path.join(packageDirectory, 'package.json')
  try {
    const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
    return { directory: packageDirectory, manifestPath: packageJsonPath, manifest }
  } catch {
    return null
  }
}

async function discoverWorkspacePackages(root) {
  const packages = []
  for (const group of workspaceGroups) {
    const groupDirectory = path.join(root, group)
    let entries
    try {
      entries = await readdir(groupDirectory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || excludedDirectories.has(entry.name)) continue
      const packageInfo = await readPackage(path.join(groupDirectory, entry.name))
      if (packageInfo?.manifest.name) packages.push(packageInfo)
    }
  }
  return packages
}

async function collectSourceFiles(directory, relativeTo) {
  const files = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (excludedDirectories.has(entry.name)) continue
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile() && sourceExtensions.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push({ absolute, relative: path.relative(relativeTo, absolute) })
      }
    }
  }
  await walk(directory)
  return files
}

function dependencySets(manifest) {
  return {
    runtime: new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]),
    development: new Set(Object.keys(manifest.devDependencies ?? {})),
  }
}

function hasExport(exportsField, subpath) {
  if (exportsField == null) return subpath === '.'
  if (typeof exportsField === 'string') return subpath === '.'
  if (Array.isArray(exportsField)) return exportsField.some((value) => hasExport(value, subpath))
  if (typeof exportsField !== 'object') return false

  const keys = Object.keys(exportsField)
  const isSubpathMap = keys.some((key) => key.startsWith('.'))
  if (!isSubpathMap) return Object.values(exportsField).some((value) => hasExport(value, subpath))
  if (Object.prototype.hasOwnProperty.call(exportsField, subpath)) return exportsField[subpath] !== null
  for (const [key, value] of Object.entries(exportsField)) {
    if (!key.includes('*')) continue
    const [before, after] = key.split('*')
    if (subpath.startsWith(before) && subpath.endsWith(after ?? '')) return value !== null
  }
  return false
}

function exportedSubpath(packageInfo, specifier) {
  const packageName = packageInfo.manifest.name
  const suffix = specifier.slice(packageName.length)
  const subpath = suffix ? `.${suffix}` : '.'
  return hasExport(packageInfo.manifest.exports, subpath)
}

function issue(importer, file, specifier, packageName, kind, detail) {
  return { importer: importer.manifest.name, file, specifier, packageName, kind, detail }
}

export async function analyzeWorkspace(root = workspaceRoot) {
  const packageInfos = await discoverWorkspacePackages(root)
  const packagesByName = new Map(packageInfos.map((info) => [info.manifest.name, info]))
  const findings = []

  for (const importer of packageInfos) {
    const sourceDirectory = path.join(importer.directory, 'src')
    let sourceFiles
    try {
      sourceFiles = await collectSourceFiles(sourceDirectory, importer.directory)
    } catch {
      continue
    }
    const dependencies = dependencySets(importer.manifest)

    for (const file of sourceFiles) {
      const isTest = testFile.test(file.relative)
      const source = await readFile(file.absolute, 'utf8')
      for (const imported of importsFromSource(source)) {
        const { specifier } = imported
        if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#') || isBuiltin(specifier)) continue

        const packageName = packageNameFromSpecifier(specifier)
        const localPackage = packagesByName.get(packageName)
        const declaredRuntime = dependencies.runtime.has(packageName)
        const declaredDevelopment = dependencies.development.has(packageName)

        if (localPackage && !exportedSubpath(localPackage, specifier)) {
          findings.push(issue(importer, file.relative, specifier, packageName, 'unexported-workspace-subpath', 'subpath is not declared by the target package exports'))
          continue
        }

        if (imported.typeOnly) continue

        if (declaredRuntime || (isTest && declaredDevelopment)) continue
        findings.push(issue(
          importer,
          file.relative,
          specifier,
          packageName,
          isTest ? 'missing-test-dependency' : 'missing-runtime-dependency',
          isTest ? 'test/story import is not declared in dependencies or devDependencies' : 'runtime import is not declared in dependencies, optionalDependencies, or peerDependencies',
        ))
      }
    }
  }

  return findings.sort((left, right) => `${left.importer}/${left.file}/${left.specifier}`.localeCompare(`${right.importer}/${right.file}/${right.specifier}`))
}

export function formatFindings(findings) {
  return findings.map((finding) => `${finding.importer} ${finding.file} -> ${finding.specifier} [${finding.kind}] ${finding.detail}`).join('\n')
}

export async function main(root = workspaceRoot) {
  const findings = await analyzeWorkspace(root)
  if (findings.length) {
    console.error(formatFindings(findings))
    return 1
  }
  console.log(`Dependências de runtime declaradas corretamente em ${workspaceGroups.join(', ')}.`)
  return 0
}

if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) process.exitCode = await main()

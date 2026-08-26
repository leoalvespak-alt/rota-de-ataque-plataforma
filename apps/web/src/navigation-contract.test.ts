import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LEGACY_REDIRECTS, NAVIGATION } from './lib/navigation'

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))
const appDirectory = path.join(sourceDirectory, 'app')

describe('navegação canônica', () => {
  it('declara sete destinos principais', () => {
    expect(NAVIGATION).toHaveLength(7)
    expect(NAVIGATION.map((destination) => destination.title)).toEqual(['Pulso', 'Inteligência', 'Decisões', 'Planejamento', 'Público', 'Performance', 'Sistema'])
    expect(new Set(NAVIGATION.map((destination) => destination.href)).size).toBe(7)
  })

  it('preserva os 28 pontos de entrada anteriores: raiz mais 27 redirects permanentes', async () => {
    expect(Object.keys(LEGACY_REDIRECTS).length).toBeGreaterThanOrEqual(27)
    await access(path.join(appDirectory, 'page.tsx'))

    for (const [legacyPath, target] of Object.entries(LEGACY_REDIRECTS)) {
      const directory = path.join(appDirectory, ...legacyPath.slice(1).split('/'))
      const redirectSource = await readFile(path.join(directory, 'page.tsx'), 'utf8')
      await access(path.join(directory, 'view.tsx'))
      const [canonicalPath] = target.split('?')
      expect(redirectSource).toContain('permanentLegacyRedirect')
      if (!canonicalPath) throw new Error(`redirect target missing canonical path for ${legacyPath}`)
      expect(redirectSource).toContain(`'${canonicalPath}'`)

      const canonicalDirectory = canonicalPath === '/' ? appDirectory : path.join(appDirectory, ...canonicalPath.slice(1).split('/'))
      await readFile(path.join(canonicalDirectory, 'page.tsx'), 'utf8')
    }
  })

  it('mantém detalhe de conteúdo e contratos acessíveis das abas', async () => {
    await access(path.join(appDirectory, 'content-items', '[id]', 'page.tsx'))
    const tabs = await readFile(path.join(sourceDirectory, 'components', 'RouteTabs.tsx'), 'utf8')
    expect(tabs).toMatch(/role="tablist"/u)
    expect(tabs).toMatch(/ArrowRight/u)
    expect(tabs).toMatch(/ArrowLeft/u)
    expect(tabs).toContain('TabArrowButtons')
    const subnav = await readFile(path.join(sourceDirectory, '..', '..', '..', 'packages', 'ui-bridge', 'src', 'ModuleSubnav.tsx'), 'utf8')
    expect(subnav).toContain('TabArrowButtons')
    const arrows = await readFile(path.join(sourceDirectory, '..', '..', '..', 'packages', 'ui-bridge', 'src', 'TabNavigation.tsx'), 'utf8')
    expect(arrows).toContain('Aba anterior')
    expect(arrows).toContain('Próxima aba')
    await expect(readFile(path.join(sourceDirectory, 'components', 'UiModeProvider.tsx'), 'utf8')).rejects.toThrow()
  })
})

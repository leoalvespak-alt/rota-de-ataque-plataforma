import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LEGACY_REDIRECTS, NAVIGATION } from './lib/navigation'

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))
const appDirectory = path.join(sourceDirectory, 'app')

describe('aliases legados da navegação', () => {
  it('inclui as quatro entradas legadas que não pertencem mais ao mapa canônico', async () => {
    expect(LEGACY_REDIRECTS['/desempenho']).toContain('/performance')
    expect(LEGACY_REDIRECTS['/configuracoes']).toContain('/sistema')
    expect(LEGACY_REDIRECTS['/conteudo']).toContain('/planejamento')
    expect(LEGACY_REDIRECTS['/relacionamento']).toContain('/publico')

    for (const legacyPath of ['/desempenho', '/configuracoes', '/conteudo', '/relacionamento']) {
      const directory = path.join(appDirectory, ...legacyPath.slice(1).split('/'))
      await access(path.join(directory, 'page.tsx'))
      const source = await readFile(path.join(directory, 'page.tsx'), 'utf8')
      expect(source).toContain('permanentLegacyRedirect')
    }
  })

  it('expõe apenas IDs declarados pelo mapa canônico', async () => {
    const routeTabs = await readFile(path.join(sourceDirectory, 'components', 'RouteTabs.tsx'), 'utf8')
    for (const destination of NAVIGATION) expect(NAVIGATION.map((item) => item.id)).toContain(destination.id)
    expect(routeTabs).toContain('NavigationDestination')
    expect(routeTabs).not.toContain('destinationId: string')
  })
})

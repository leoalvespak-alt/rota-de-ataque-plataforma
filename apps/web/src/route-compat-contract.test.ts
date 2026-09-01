import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LEGACY_REDIRECTS, NAVIGATION } from './lib/navigation'

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))
const appDirectory = path.join(sourceDirectory, 'app')

describe('aliases legados da navegação', () => {
  it('mantém aliases editoriais fora do mapa canônico', async () => {
    expect(LEGACY_REDIRECTS['/desempenho']).toContain('/performance')
    expect(LEGACY_REDIRECTS['/conteudo']).toContain('/planejamento')
    expect(LEGACY_REDIRECTS['/review-inbox']).toContain('/decisoes')
    expect(LEGACY_REDIRECTS['/content-items']).toContain('/planejamento')

    for (const legacyPath of ['/desempenho', '/conteudo', '/review-inbox', '/content-items']) {
      const directory = path.join(appDirectory, ...legacyPath.slice(1).split('/'))
      const source = await readFile(path.join(directory, 'page.tsx'), 'utf8')
      expect(source).toContain('permanentLegacyRedirect')
    }
  })

  it('expõe apenas IDs declarados pelo mapa canônico', async () => {
    const routeTabs = await readFile(path.join(sourceDirectory, 'components', 'RouteTabs.tsx'), 'utf8')
    for (const destination of NAVIGATION) expect(NAVIGATION.map((item) => item.id)).toContain(destination.id)
    expect(routeTabs).toContain('NavigationDestination')
    expect(routeTabs).not.toContain('destinationId: string')
    await access(path.join(appDirectory, 'radar', 'page.tsx'))
  })
})

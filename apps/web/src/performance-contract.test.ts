import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url))

describe('contratos de Performance', () => {
  it('conta provider_usage pela coluna temporal real', async () => {
    const source = await readFile(path.join(sourceDirectory, 'app', 'performance', 'page.tsx'), 'utf8')
    expect(source).toContain('recorded_at')
    expect(source).not.toContain('provider_usage WHERE created_at')
  })

  it('exibe as métricas de followback e retenção de source_metrics', async () => {
    const source = await readFile(path.join(sourceDirectory, 'app', 'source-roi', 'SourceRoiClient.tsx'), 'utf8')
    expect(source).toContain('followbackRate')
    expect(source).toContain('retention7dRate')
    expect(source).toContain('FreshnessLabel')
  })

  it('mantém o grão por variante na aba de conteúdo', async () => {
    const source = await readFile(path.join(sourceDirectory, 'app', 'desempenho', 'ContentPerformance.tsx'), 'utf8')
    expect(source).toContain('variant.id')
    expect(source).toContain('computed_at')
    expect(source).toContain('DataPageControls')
  })
})

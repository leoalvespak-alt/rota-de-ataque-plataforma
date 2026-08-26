import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BlockedState, FilteredEmptyState, MetricStrip, ModuleHeader, WorkspaceGrid } from './module.js'

describe('module blueprint', () => {
  it('renders real metric metadata and preserves drill-down links', () => {
    const markup = renderToStaticMarkup(<MetricStrip metrics={[{ label: 'Pendências', value: 3, period: 'agora', sourceStatus: 'ready', href: '/decisoes' }]} />)
    expect(markup).toContain('Pendências')
    expect(markup).toContain('fonte pronta')
    expect(markup).toContain('href="/decisoes"')
  })

  it('keeps the workspace blueprint explicit', () => {
    const markup = renderToStaticMarkup(<WorkspaceGrid main={<div>principal</div>} rail={<div>contexto</div>} />)
    expect(markup).toContain('module-main-panel')
    expect(markup).toContain('module-rail')
  })

  it('distinguishes blocked and filtered-empty states', () => {
    const blocked = renderToStaticMarkup(<BlockedState title="Integração bloqueada" reason="Pré-requisito ausente." />)
    const filtered = renderToStaticMarkup(<FilteredEmptyState message="Remova o filtro para ver a fila." />)
    expect(blocked).toContain('class="state blocked"')
    expect(filtered).toContain('class="state filtered-empty"')
  })

  it('renders the canonical header hierarchy', () => {
    const markup = renderToStaticMarkup(<ModuleHeader eyebrow="Operação" title="Pulso" subtitle="Próxima ação" context="servidor" />)
    expect(markup).toContain('module-eyebrow')
    expect(markup).toContain('Pulso')
    expect(markup).toContain('servidor')
  })
})

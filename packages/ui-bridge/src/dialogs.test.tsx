// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog, Dialog, Tabs, TabsContent, TabsList, TabsTrigger } from './dialogs'

describe('canonical dialog and tabs contracts', () => {
  it('renders labelled modal semantics', () => {
    const html = renderToStaticMarkup(createElement(Dialog, { open: true, onOpenChange: vi.fn(), title: 'Editar', children: createElement('button', null, 'Salvar') }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Editar')
  })

  it('renders alertdialog and linked tabs/panel semantics', () => {
    const alert = renderToStaticMarkup(createElement(ConfirmDialog, { open: true, onOpenChange: vi.fn(), title: 'Confirmar', description: 'Descrição', onConfirm: vi.fn() }))
    const tabsList = createElement(TabsList, { key: 'list', children: createElement(TabsTrigger, { value: 'one', children: 'Um' }) })
    const tabsContent = createElement(TabsContent, { key: 'content', value: 'one', children: 'Conteúdo' })
    const tabs = renderToStaticMarkup(createElement(Tabs, { defaultValue: 'one', children: [tabsList, tabsContent] }))
    expect(alert).toContain('role="alertdialog"')
    expect(alert).toContain('aria-describedby=')
    expect(tabs).toContain('role="tablist"')
    expect(tabs).toContain('role="tabpanel"')
    expect(tabs).toContain('aria-controls=')
  })
})

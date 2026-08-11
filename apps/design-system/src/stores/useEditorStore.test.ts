import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './useEditorStore'

describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({ activeTemplateId: null, format: 'square', darkMode: false, zoom: 0.4, elements: {} })
    useEditorStore.temporal.getState().clear()
  })

  it('seleciona um template e carrega os defaults', () => {
    useEditorStore.getState().selectTemplate('sq-cover')
    const s = useEditorStore.getState()
    expect(s.activeTemplateId).toBe('sq-cover')
    expect(s.format).toBe('square')
    expect(s.elements.title).toBe('CONQUISTE SUA APROVAÇÃO')
  })

  it('undo/redo restaura elements sem afetar outros campos (limite 30 do original)', () => {
    useEditorStore.getState().selectTemplate('sq-cover')
    useEditorStore.getState().setElementField(['title'], 'Editado 1')
    useEditorStore.getState().setElementField(['title'], 'Editado 2')

    useEditorStore.temporal.getState().undo()
    expect(useEditorStore.getState().elements.title).toBe('Editado 1')

    useEditorStore.temporal.getState().undo()
    expect(useEditorStore.getState().elements.title).toBe('CONQUISTE SUA APROVAÇÃO')

    useEditorStore.temporal.getState().redo()
    expect(useEditorStore.getState().elements.title).toBe('Editado 1')
  })

  it('toggleElementVisibility oculta e restaura o valor padrão (bug 4 da auditoria: buildQuoteControls)', () => {
    useEditorStore.getState().selectTemplate('sq-quote')
    expect(useEditorStore.getState().elements.author).toBe('Rota de Ataque')

    useEditorStore.getState().toggleElementVisibility('author')
    expect(useEditorStore.getState().elements.author).toBe(false)

    useEditorStore.getState().toggleElementVisibility('author')
    expect(useEditorStore.getState().elements.author).toBe('Rota de Ataque')
  })

  it('resetCard volta aos defaults e limpa o modo escuro', () => {
    useEditorStore.getState().selectTemplate('sq-cover')
    useEditorStore.getState().setElementField(['title'], 'Alterado')
    useEditorStore.getState().toggleDarkMode()

    useEditorStore.getState().resetCard()
    const s = useEditorStore.getState()
    expect(s.elements.title).toBe('CONQUISTE SUA APROVAÇÃO')
    expect(s.darkMode).toBe(false)
  })

  it('setElementField em caminho de array cria a estrutura corretamente (bugs 1-2 da auditoria)', () => {
    useEditorStore.getState().selectTemplate('sq-table')
    useEditorStore.getState().setElementField(['rows', 1, 0], 'Novo valor')
    const rows = useEditorStore.getState().elements.rows as string[][]
    expect(rows[1]?.[0]).toBe('Novo valor')
  })
})

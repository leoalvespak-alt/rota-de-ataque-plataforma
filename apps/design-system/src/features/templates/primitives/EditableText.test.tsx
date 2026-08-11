import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableText } from './EditableText'
import { useEditorStore } from '@/stores/useEditorStore'

/**
 * FASE 5 — testes do ponto de risco #1 do plano de migração (contentEditable + React).
 * Cobre exatamente os bugs 1-2 da auditoria original: edição em campos simples e em
 * campos de array/objeto aninhado deve sobreviver a um re-render externo.
 */
describe('EditableText', () => {
  beforeEach(() => {
    useEditorStore.setState({ elements: {}, activeTemplateId: 'test', format: 'square', darkMode: false, zoom: 0.4 })
  })

  it('grava no store (path simples) ao digitar e disparar input', () => {
    render(<EditableText path="title" value="Olá" />)
    const el = screen.getByText('Olá')
    el.textContent = 'Olá Mundo'
    fireEvent.input(el)
    expect(useEditorStore.getState().elements.title).toBe('Olá Mundo')
  })

  it('grava em caminho aninhado (array de objetos) sem criar chave solta', () => {
    useEditorStore.setState({ elements: { stats: [{ num: '10', label: 'x' }] } })
    render(<EditableText path="stats.0.num" value="10" />)
    const el = screen.getByText('10')
    el.textContent = '99'
    fireEvent.input(el)
    const stats = useEditorStore.getState().elements.stats as Array<{ num: string; label: string }>
    expect(stats[0]?.num).toBe('99')
    // Nenhuma chave solta tipo "stats.0.num" deve existir na raiz (bug original 1-2).
    expect(useEditorStore.getState().elements['stats.0.num']).toBeUndefined()
  })

  it('não sobrescreve o DOM enquanto o elemento está focado (evita reset de cursor)', () => {
    const { rerender } = render(<EditableText path="title" value="A" />)
    const el = screen.getByText('A')
    fireEvent.focus(el)
    el.textContent = 'A editado pelo usuário'
    fireEvent.input(el)
    // Re-render externo com um valor "antigo" (simula outra parte do state mudando)
    rerender(<EditableText path="title" value="A" />)
    // Enquanto focado, o DOM não deve ter sido resetado para "A".
    expect(el.textContent).toBe('A editado pelo usuário')
  })

  it('sincroniza do store para o DOM quando o valor muda externamente e não está focado', () => {
    const { rerender } = render(<EditableText path="title" value="Antigo" />)
    rerender(<EditableText path="title" value="Novo valor (ex: undo)" />)
    expect(screen.getByText('Novo valor (ex: undo)')).toBeInTheDocument()
  })
})

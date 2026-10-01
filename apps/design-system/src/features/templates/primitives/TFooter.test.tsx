import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TFooter } from './TFooter'

describe('TFooter', () => {
  it('renders brand and swipe hint without card pagination', () => {
    const { container } = render(<TFooter />)
    expect(screen.getByTestId('slot-footer')).toBeInTheDocument()
    expect(screen.getByTestId('slot-swipe-hint')).toBeInTheDocument()
    expect(screen.getByText('ROTA DE ATAQUE')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/)
  })

  it('hides the swipe hint on closing cards', () => {
    render(<TFooter showSwipeHint={false} brand="FIM" />)
    expect(screen.queryByTestId('slot-swipe-hint')).not.toBeInTheDocument()
    expect(screen.getByText('FIM')).toBeInTheDocument()
  })
})

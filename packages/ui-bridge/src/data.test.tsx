import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createColumnHelper } from '@tanstack/react-table'
import { DataGrid, gridFeatures } from './data.js'

const column = createColumnHelper<typeof gridFeatures, { id: string; name: string; value: number }>()
const columns = [
  column.accessor('name', { header: 'Nome' }),
  column.accessor('value', { header: 'Valor' }),
]
const data = [{ id: '1', name: 'Alpha', value: 10 }, { id: '2', name: 'Beta', value: 20 }]

describe('DataGrid — TanStack Table v9 compliance', () => {
  it('renders without options (base case)', () => {
    const markup = renderToStaticMarkup(<DataGrid columns={columns} data={data} />)
    expect(markup).toContain('Alpha')
    expect(markup).toContain('Beta')
    expect(markup).toContain('Nome')
  })

  it('renders with enableSorting', () => {
    const markup = renderToStaticMarkup(<DataGrid columns={columns} data={data} enableSorting />)
    expect(markup).toContain('Alpha')
    expect(markup).toContain('aria-sort')
  })

  it('renders with enableSelection', () => {
    const markup = renderToStaticMarkup(<DataGrid columns={columns} data={data} enableSelection />)
    expect(markup).toContain('Alpha')
  })

  it('renders with enablePagination', () => {
    const markup = renderToStaticMarkup(<DataGrid columns={columns} data={data} enablePagination />)
    expect(markup).toContain('Página')
  })

  it('exports gridFeatures with expected shape', () => {
    expect(gridFeatures).toBeDefined()
    expect(typeof gridFeatures).toBe('object')
  })
})

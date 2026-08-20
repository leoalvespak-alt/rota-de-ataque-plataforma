'use client'
import React, { type ReactNode, useCallback, useRef } from 'react'
import {
  type ColumnDef,
  useTable,
  createCoreRowModel,
  flexRender,
  createPaginatedRowModel,
  createSortedRowModel,
  createColumnHelper,
  tableFeatures,
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

import { SparklineInline } from './charts'

export const gridFeatures = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

// Re-export for consumers
export { createColumnHelper }

export const KpiCard = ({
  label,
  value,
  delta,
  trend,
  sparklineData,
  period,
  explanation,
  drillDownHref,
  density = 'compact',
}: {
  label: string
  value: string | number
  delta?: number
  trend?: 'up' | 'down' | 'neutral'
  sparklineData?: number[]
  period?: string
  explanation?: string
  drillDownHref?: string
  density?: 'compact' | 'standard'
}) => (
  <article className={`bridge-kpi-card bridge-kpi-card--${density}`}>
    <div className="bridge-kpi-header">
      <span className="bridge-kpi-label" title={explanation}>{label}</span>
      {sparklineData && (
        <div className="bridge-kpi-sparkline">
          <SparklineInline data={sparklineData} color={trend === 'down' ? 'var(--status-error)' : 'var(--status-success)'} />
        </div>
      )}
    </div>
    <strong className="bridge-kpi-value">
      {drillDownHref ? <a href={drillDownHref}>{value}</a> : value}
    </strong>
    {delta !== undefined && (
      <small className={`bridge-kpi-delta ${trend || (delta >= 0 ? 'up' : 'down')}`} aria-label={`Variação ${delta}%`}>
        {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
      </small>
    )}
    {period && <div className="bridge-kpi-period"><small>{period}</small></div>}
  </article>
)

export const MetricGroup = ({ children, title }: { children: ReactNode; title?: string }) => (
  <section className="bridge-metric-group">
    {title && <h3 className="bridge-metric-group-title">{title}</h3>}
    <div className="bridge-metric-group-content">{children}</div>
  </section>
)

export const InsightCard = ({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) => (
  <article className="bridge-insight-card">
    <header>
      {icon && <span className="bridge-insight-icon">{icon}</span>}
      <h4>{title}</h4>
    </header>
    <div className="bridge-insight-content">{children}</div>
  </article>
)

export const NextBestActionCard = ({ action, rationale, onApprove }: { action: string; rationale: string; onApprove: () => void }) => (
  <article className="bridge-nba-card">
    <h4>Próxima Melhor Ação</h4>
    <p><strong>{action}</strong></p>
    <p className="bridge-nba-rationale">{rationale}</p>
    <button onClick={onApprove} className="bridge-button" data-variant="primary">Aprovar e Executar</button>
  </article>
)

export const ScoreBadge = ({ score, label }: { score: number, label?: string }) => {
  const quality = score >= 80 ? 'high' : score >= 50 ? 'med' : 'low'
  return (
    <span className={`bridge-dq-badge ${quality}`} title={label ? `${label}: ${score}` : `Score: ${score}`}>
      {label ? `${label}: ` : ''}{score}
    </span>
  )
}

export const SourceFreshness = ({ lastUpdate, source }: { lastUpdate: string; source: string }) => (
  <div className="bridge-source-freshness">
    <small>Sincronizado {lastUpdate} via {source}</small>
  </div>
)

interface DataGridProps<TData> {
  columns: any[]
  data: TData[]
  loading?: boolean
  enableSelection?: boolean
  enableSorting?: boolean
  enablePagination?: boolean
  enableColumnVisibility?: boolean
  onSelectionChange?: (selectedIds: string[]) => void
  label?: string
}

export function DataGrid<TData>({
  columns,
  data,
  loading,
  enableSelection = false,
  enableSorting = false,
  enablePagination = false,
  enableColumnVisibility = false,
  onSelectionChange,
  label
}: DataGridProps<TData>) {
  const [sorting, setSorting] = React.useState<any[]>([])
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })
  const [focusedRow, setFocusedRow] = React.useState(0)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  const table = useTable({
    features: gridFeatures,
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      pagination,
    },
    onPaginationChange: setPagination as any,
    enableRowSelection: enableSelection,
    enableSorting,
    onRowSelectionChange: (updaterOrValue: any) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(rowSelection) : updaterOrValue
      setRowSelection(next)
      if (onSelectionChange) {
        onSelectionChange(Object.keys(next).filter((k: string) => next[k]))
      }
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  } as any)

  const rows = (table as any).getRowModel().rows

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableElement>) => {
    const rowCount = rows.length
    if (rowCount === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(focusedRow + 1, rowCount - 1)
      setFocusedRow(next)
      const el = tbodyRef.current?.querySelectorAll('tr')[next] as HTMLElement
      el?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(focusedRow - 1, 0)
      setFocusedRow(prev)
      const el = tbodyRef.current?.querySelectorAll('tr')[prev] as HTMLElement
      el?.focus()
    } else if (e.key === ' ' && enableSelection) {
      e.preventDefault()
      const row = rows[focusedRow]
      if (row) row.getToggleSelectedHandler()(e as any)
    }
  }, [focusedRow, rows, enableSelection])

  const t = table as any

  return (
    <div className="bridge-data-grid-wrapper">
      {enableColumnVisibility && (
        <div className="bridge-data-grid-toolbar" style={{ padding: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {t.getAllLeafColumns().map((column: any) => (
            <label key={column.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
              />
              {column.id}
            </label>
          ))}
        </div>
      )}
      <div className="bridge-data-grid-container" style={{ overflowX: 'auto' }}>
        <table
          className="bridge-data-grid"
          role="grid"
          aria-label={label ?? 'Tabela de dados'}
          onKeyDown={handleKeyDown}
        >
          <thead>
            {t.getHeaderGroups().map((headerGroup: any) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header: any) => (
                  <th
                    key={header.id}
                    role="columnheader"
                    aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        header.column.getIsSorted() === 'asc'
                          ? <ChevronUp size={14} />
                          : header.column.getIsSorted() === 'desc'
                            ? <ChevronDown size={14} />
                            : <ChevronsUpDown size={14} style={{ opacity: 0.4 }} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody ref={tbodyRef}>
            {loading ? (
              <tr role="row">
                <td colSpan={columns.length} className="bridge-data-grid-loading" role="gridcell">Carregando...</td>
              </tr>
            ) : rows?.length ? (
              rows.map((row: any, idx: number) => (
                <tr
                  key={row.id}
                  role="row"
                  tabIndex={idx === focusedRow ? 0 : -1}
                  data-selected={row.getIsSelected()}
                  onClick={() => { setFocusedRow(idx); if (enableSelection) row.getToggleSelectedHandler()(undefined as any) }}
                  onFocus={() => setFocusedRow(idx)}
                  style={{ cursor: enableSelection ? 'pointer' : 'default' }}
                >
                  {row.getVisibleCells().map((cell: any) => (
                    <td key={cell.id} role="gridcell">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr role="row">
                <td colSpan={columns.length} className="bridge-data-grid-empty" role="gridcell">
                  Nenhum resultado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {enablePagination && (
        <div className="bridge-data-grid-pagination" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px' }}>
            Página <strong>{pagination.pageIndex + 1} de {t.getPageCount?.() ?? Math.ceil(data.length / pagination.pageSize)}</strong>
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => t.previousPage()} disabled={!t.getCanPreviousPage()}>
              Anterior
            </button>
            <button onClick={() => t.nextPage()} disabled={!t.getCanNextPage()}>
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

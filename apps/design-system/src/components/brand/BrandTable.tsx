import { cn } from '@/lib/utils'

interface BrandTableProps {
  headers: string[]
  rows: string[][]
  dark?: boolean
  striped?: boolean
  className?: string
}

export function BrandTable({ headers, rows, dark, striped = true, className }: BrandTableProps) {
  const borderColor = dark ? 'var(--dark-border)' : 'var(--light-border)'
  const headerBg = dark ? 'var(--dark-s1)' : 'var(--light-bg-alt)'
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'
  const muted = dark ? 'var(--dark-muted)' : 'var(--light-muted)'
  const stripeBg = dark ? 'var(--dark-s2)' : 'rgba(0,0,0,0.02)'

  return (
    <div className={cn('overflow-x-auto rounded-[var(--radius-sm)]', className)}>
      <table
        className="w-full border-collapse font-body text-sm"
        style={{ color: text, borderColor }}
      >
        <thead>
          <tr style={{ background: headerBg }}>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-heading font-bold text-xs tracking-wider uppercase"
                style={{ borderBottom: `2px solid var(--red)`, color: muted }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                background: striped && ri % 2 === 1 ? stripeBg : 'transparent',
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

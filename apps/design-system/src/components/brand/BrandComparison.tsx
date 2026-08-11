import { cn } from '@/lib/utils'

interface ComparisonItem {
  label: string
  left: string
  right: string
}

interface BrandComparisonProps {
  leftTitle: string
  rightTitle: string
  items: ComparisonItem[]
  dark?: boolean
  className?: string
}

export function BrandComparison({
  leftTitle,
  rightTitle,
  items,
  dark,
  className,
}: BrandComparisonProps) {
  const bg = dark ? 'var(--dark-s1)' : 'var(--light-bg-alt)'
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'
  const muted = dark ? 'var(--dark-muted)' : 'var(--light-muted)'
  const border = dark ? 'var(--dark-border)' : 'var(--light-border)'

  return (
    <div className={cn('rounded-[var(--radius-sm)] overflow-hidden', className)} style={{ background: bg }}>
      <div className="grid grid-cols-2" style={{ borderBottom: `2px solid var(--red)` }}>
        <div className="px-4 py-3 font-heading font-bold text-xs tracking-wider uppercase" style={{ color: 'var(--red)' }}>
          {leftTitle}
        </div>
        <div className="px-4 py-3 font-heading font-bold text-xs tracking-wider uppercase text-right" style={{ color: muted }}>
          {rightTitle}
        </div>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-2"
          style={{ borderBottom: i < items.length - 1 ? `1px solid ${border}` : undefined }}
        >
          <div className="px-4 py-3">
            <div className="font-body text-xs uppercase tracking-wide mb-1" style={{ color: muted }}>
              {item.label}
            </div>
            <div className="font-body text-sm font-medium" style={{ color: text }}>
              {item.left}
            </div>
          </div>
          <div className="px-4 py-3 text-right">
            <div className="font-body text-sm font-medium mt-5" style={{ color: text }}>
              {item.right}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

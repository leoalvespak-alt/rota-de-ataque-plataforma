import { cn } from '@/lib/utils'

interface BrandFormulaProps {
  expression: string
  label?: string
  dark?: boolean
  className?: string
}

export function BrandFormula({ expression, label, dark, className }: BrandFormulaProps) {
  const bg = dark ? 'var(--dark-s1)' : 'var(--light-bg-alt)'
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'
  const muted = dark ? 'var(--dark-muted)' : 'var(--light-muted)'

  return (
    <div className={cn('rounded-[var(--radius-sm)] p-4', className)} style={{ background: bg }}>
      {label && (
        <div className="font-heading font-semibold text-xs tracking-wider uppercase mb-2" style={{ color: muted }}>
          {label}
        </div>
      )}
      <div
        className="font-numeral text-lg text-center py-2"
        style={{ color: text }}
        dangerouslySetInnerHTML={{ __html: expression }}
      />
    </div>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CalloutVariant = 'info' | 'warning' | 'danger' | 'success' | 'tip' | 'law' | 'concept'

interface BrandCalloutProps {
  variant?: CalloutVariant
  title?: string
  dark?: boolean
  className?: string
  children: ReactNode
}

const variantConfig: Record<CalloutVariant, { color: string; label: string }> = {
  info: { color: 'var(--info)', label: 'INFORMACAO' },
  warning: { color: 'var(--warning)', label: 'ATENCAO' },
  danger: { color: 'var(--danger)', label: 'CUIDADO' },
  success: { color: 'var(--success)', label: 'CORRETO' },
  tip: { color: 'var(--gold)', label: 'DICA TATICA' },
  law: { color: 'var(--info)', label: 'DISPOSITIVO LEGAL' },
  concept: { color: 'var(--red)', label: 'CONCEITO' },
}

export function BrandCallout({
  variant = 'info',
  title,
  dark,
  className,
  children,
}: BrandCalloutProps) {
  const config = variantConfig[variant]
  const bg = dark ? 'var(--dark-s2)' : 'var(--light-bg-alt)'
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'

  return (
    <div
      className={cn('rounded-[var(--radius-sm)] overflow-hidden', className)}
      style={{ background: bg, color: text }}
    >
      <div className="flex">
        <div className="w-1 shrink-0" style={{ background: config.color }} />
        <div className="p-4 flex-1">
          <div
            className="font-heading font-bold text-xs tracking-wider uppercase mb-2"
            style={{ color: config.color }}
          >
            {title ?? config.label}
          </div>
          <div className="font-body text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

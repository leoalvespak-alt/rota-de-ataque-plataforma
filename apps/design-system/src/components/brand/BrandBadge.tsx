import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'accent' | 'gold' | 'outline' | 'ghost'

interface BrandBadgeProps {
  variant?: BadgeVariant
  dark?: boolean
  className?: string
  children: ReactNode
}

const variantClasses: Record<BadgeVariant, { light: string; dark: string }> = {
  default: {
    light: 'bg-[var(--red)] text-white',
    dark: 'bg-[var(--red)] text-white',
  },
  accent: {
    light: 'bg-[var(--red-light)] text-white',
    dark: 'bg-[var(--red-light)] text-white',
  },
  gold: {
    light: 'bg-[var(--gold)] text-[var(--light-text)]',
    dark: 'bg-[var(--gold)] text-[var(--dark-bg)]',
  },
  outline: {
    light: 'border border-[var(--light-border)] text-[var(--light-text)]',
    dark: 'border border-[var(--dark-border)] text-[var(--dark-text)]',
  },
  ghost: {
    light: 'bg-[var(--light-bg-alt)] text-[var(--light-muted)]',
    dark: 'bg-[var(--dark-s2)] text-[var(--dark-muted)]',
  },
}

export function BrandBadge({ variant = 'default', dark, className, children }: BrandBadgeProps) {
  const classes = dark ? variantClasses[variant].dark : variantClasses[variant].light
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-[var(--radius-pill)]',
        'font-heading font-semibold text-xs tracking-wider uppercase',
        classes,
        className,
      )}
    >
      {children}
    </span>
  )
}

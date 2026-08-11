import { cn } from '@/lib/utils'

type DividerVariant = 'line' | 'accent' | 'dots' | 'gradient'

interface BrandDividerProps {
  variant?: DividerVariant
  dark?: boolean
  className?: string
}

export function BrandDivider({ variant = 'line', dark, className }: BrandDividerProps) {
  const baseColor = dark ? 'var(--dark-border)' : 'var(--light-border)'

  if (variant === 'accent') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="h-[2px] flex-1" style={{ background: baseColor }} />
        <div className="w-2 h-2 rounded-full bg-[var(--red)]" />
        <div className="h-[2px] flex-1" style={{ background: baseColor }} />
      </div>
    )
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex justify-center gap-2 py-2', className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: i === 1 ? 'var(--red)' : baseColor }}
          />
        ))}
      </div>
    )
  }

  if (variant === 'gradient') {
    return (
      <div
        className={cn('h-[2px]', className)}
        style={{
          background: `linear-gradient(90deg, transparent, var(--red), transparent)`,
        }}
      />
    )
  }

  return (
    <hr
      className={cn('border-0 h-[1px]', className)}
      style={{ background: baseColor }}
    />
  )
}

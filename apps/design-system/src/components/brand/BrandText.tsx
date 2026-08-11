import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BrandTextVariant = 'heading' | 'body' | 'eyebrow' | 'caption' | 'numeral' | 'quote'

interface BrandTextProps {
  variant?: BrandTextVariant
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'blockquote'
  dark?: boolean
  uppercase?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

const variantStyles: Record<BrandTextVariant, string> = {
  heading: 'font-heading font-bold tracking-wide leading-tight uppercase',
  body: 'font-body font-normal leading-normal',
  eyebrow: 'font-heading font-semibold text-xs tracking-widest uppercase',
  caption: 'font-body font-light text-sm leading-relaxed',
  numeral: 'font-numeral font-bold tabular-nums',
  quote: 'font-body font-light italic leading-relaxed',
}

const defaultTag: Record<BrandTextVariant, BrandTextProps['as']> = {
  heading: 'h2',
  body: 'p',
  eyebrow: 'span',
  caption: 'p',
  numeral: 'span',
  quote: 'blockquote',
}

export function BrandText({
  variant = 'body',
  as,
  dark,
  uppercase,
  className,
  style,
  children,
}: BrandTextProps) {
  const Tag = as ?? defaultTag[variant] ?? 'span'
  return (
    <Tag
      className={cn(
        variantStyles[variant],
        dark ? 'text-[var(--dark-text)]' : 'text-[var(--light-text)]',
        uppercase && 'uppercase',
        className,
      )}
      style={style}
    >
      {children}
    </Tag>
  )
}

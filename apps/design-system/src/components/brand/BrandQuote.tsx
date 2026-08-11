import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BrandQuoteProps {
  author?: string
  source?: string
  dark?: boolean
  className?: string
  children: ReactNode
}

export function BrandQuote({ author, source, dark, className, children }: BrandQuoteProps) {
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'
  const muted = dark ? 'var(--dark-muted)' : 'var(--light-muted)'

  return (
    <blockquote className={cn('relative pl-6', className)}>
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
        style={{ background: 'var(--red)' }}
      />
      <div
        className="font-body font-light text-lg leading-relaxed italic"
        style={{ color: text }}
      >
        {children}
      </div>
      {(author ?? source) && (
        <footer className="mt-3 font-heading font-semibold text-sm tracking-wide uppercase" style={{ color: muted }}>
          {author}
          {source && (
            <span className="font-body font-normal normal-case tracking-normal"> — {source}</span>
          )}
        </footer>
      )}
    </blockquote>
  )
}

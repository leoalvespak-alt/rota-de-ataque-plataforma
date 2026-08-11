import { cn } from '@/lib/utils'

interface BrandCodeBlockProps {
  code: string
  language?: string
  dark?: boolean
  className?: string
}

export function BrandCodeBlock({ code, language, dark, className }: BrandCodeBlockProps) {
  const bg = dark ? '#111111' : '#1a1a1a'

  return (
    <div className={cn('rounded-[var(--radius-sm)] overflow-hidden', className)}>
      {language && (
        <div
          className="px-4 py-2 font-heading font-semibold text-xs tracking-wider uppercase"
          style={{ background: 'var(--red)', color: 'white' }}
        >
          {language}
        </div>
      )}
      <pre
        className="p-4 overflow-x-auto text-sm leading-relaxed"
        style={{
          background: bg,
          color: '#e0e0e0',
          fontFamily: "'IBM Plex Mono', 'Space Grotesk', monospace",
          margin: 0,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

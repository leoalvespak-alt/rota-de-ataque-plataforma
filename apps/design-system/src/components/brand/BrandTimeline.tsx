import { cn } from '@/lib/utils'

interface TimelineItem {
  label: string
  description?: string
  active?: boolean
}

interface BrandTimelineProps {
  items: TimelineItem[]
  dark?: boolean
  className?: string
}

export function BrandTimeline({ items, dark, className }: BrandTimelineProps) {
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'
  const muted = dark ? 'var(--dark-muted)' : 'var(--light-muted)'
  const lineColor = dark ? 'var(--dark-border)' : 'var(--light-border)'

  return (
    <div className={cn('relative', className)}>
      <div
        className="absolute left-[7px] top-2 bottom-2 w-[2px]"
        style={{ background: lineColor }}
      />
      <div className="flex flex-col gap-6">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 items-start relative">
            <div
              className="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5"
              style={{
                borderColor: item.active ? 'var(--red)' : lineColor,
                background: item.active ? 'var(--red)' : 'transparent',
              }}
            />
            <div>
              <div
                className="font-heading font-bold text-sm tracking-wide uppercase"
                style={{ color: item.active ? 'var(--red)' : text }}
              >
                {item.label}
              </div>
              {item.description && (
                <div className="font-body text-sm mt-1 leading-relaxed" style={{ color: muted }}>
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

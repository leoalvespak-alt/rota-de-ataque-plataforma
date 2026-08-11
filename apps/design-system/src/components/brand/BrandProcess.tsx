import { cn } from '@/lib/utils'

interface ProcessStep {
  number: number | string
  title: string
  description?: string
}

interface BrandProcessProps {
  steps: ProcessStep[]
  dark?: boolean
  direction?: 'horizontal' | 'vertical'
  className?: string
}

export function BrandProcess({ steps, dark, direction = 'vertical', className }: BrandProcessProps) {
  const text = dark ? 'var(--dark-text)' : 'var(--light-text)'
  const muted = dark ? 'var(--dark-muted)' : 'var(--light-muted)'

  if (direction === 'horizontal') {
    return (
      <div className={cn('flex items-start gap-2', className)}>
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2 flex-1">
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-numeral font-bold text-white text-sm shrink-0"
                style={{ background: 'var(--red)' }}
              >
                {step.number}
              </div>
              <div className="text-center">
                <div className="font-heading font-bold text-xs tracking-wide uppercase" style={{ color: text }}>
                  {step.title}
                </div>
                {step.description && (
                  <div className="font-body text-xs mt-1 leading-relaxed" style={{ color: muted }}>
                    {step.description}
                  </div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-[2px] mt-5 shrink-0" style={{ background: 'var(--red)' }} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4 items-start">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-numeral font-bold text-white text-sm shrink-0"
            style={{ background: 'var(--red)' }}
          >
            {step.number}
          </div>
          <div className="pt-1.5">
            <div className="font-heading font-bold text-sm tracking-wide uppercase" style={{ color: text }}>
              {step.title}
            </div>
            {step.description && (
              <div className="font-body text-sm mt-1 leading-relaxed" style={{ color: muted }}>
                {step.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

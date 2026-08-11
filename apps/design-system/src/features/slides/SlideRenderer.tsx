import type { SlideData } from './types'
import { SlideCanvas } from '@/components/brand'
import { BrandText, BrandDivider, BrandTimeline, BrandProcess, BrandCallout, BrandQuote, BrandTable, BrandComparison } from '@/components/brand'

interface SlideRendererProps {
  slide: SlideData
  zoom?: number
  exportMode?: boolean
}

export function SlideRenderer({ slide, zoom, exportMode }: SlideRendererProps) {
  const dark = slide.dark ?? true

  return (
    <SlideCanvas dark={dark} zoom={zoom} exportMode={exportMode}>
      <div className="h-full flex flex-col justify-center gap-6">
        {renderSlideContent(slide, dark)}
      </div>
    </SlideCanvas>
  )
}

function renderSlideContent(slide: SlideData, dark: boolean) {
  switch (slide.type) {
    case 'cover':
      return (
        <div className="flex flex-col justify-center items-center text-center gap-6 h-full">
          <BrandText variant="heading" dark={dark} className="text-5xl">
            {slide.title ?? ''}
          </BrandText>
          {slide.subtitle && (
            <BrandText variant="body" dark={dark} className="text-xl opacity-70">
              {slide.subtitle}
            </BrandText>
          )}
          <BrandDivider variant="gradient" dark={dark} className="w-48" />
        </div>
      )

    case 'section':
      return (
        <div className="flex flex-col justify-center items-center text-center gap-4 h-full">
          <BrandText variant="eyebrow" dark={dark} style={{ color: 'var(--red)' }}>
            SECAO
          </BrandText>
          <BrandText variant="heading" dark={dark} className="text-4xl">
            {slide.title ?? ''}
          </BrandText>
        </div>
      )

    case 'concept':
      return (
        <>
          <BrandText variant="heading" dark={dark} className="text-3xl">
            {slide.title ?? ''}
          </BrandText>
          <BrandCallout variant="concept" dark={dark}>
            {slide.content ?? ''}
          </BrandCallout>
        </>
      )

    case 'comparison':
      return (
        <>
          <BrandText variant="heading" dark={dark} className="text-3xl">
            {slide.title ?? ''}
          </BrandText>
          <BrandComparison
            leftTitle={(slide.data?.leftTitle as string) ?? 'A'}
            rightTitle={(slide.data?.rightTitle as string) ?? 'B'}
            items={(slide.data?.items as Array<{ label: string; left: string; right: string }>) ?? []}
            dark={dark}
          />
        </>
      )

    case 'timeline':
      return (
        <>
          <BrandText variant="heading" dark={dark} className="text-3xl">
            {slide.title ?? ''}
          </BrandText>
          <BrandTimeline
            items={(slide.items ?? []).map((item, i) => ({ label: item, active: i === 0 }))}
            dark={dark}
          />
        </>
      )

    case 'process':
      return (
        <>
          <BrandText variant="heading" dark={dark} className="text-3xl">
            {slide.title ?? ''}
          </BrandText>
          <BrandProcess
            steps={(slide.items ?? []).map((item, i) => ({ number: i + 1, title: item }))}
            dark={dark}
            direction="horizontal"
          />
        </>
      )

    case 'quote':
      return (
        <div className="flex items-center h-full">
          <BrandQuote
            author={(slide.data?.author as string) ?? undefined}
            source={(slide.data?.source as string) ?? undefined}
            dark={dark}
          >
            {slide.content ?? ''}
          </BrandQuote>
        </div>
      )

    case 'table':
      return (
        <>
          <BrandText variant="heading" dark={dark} className="text-3xl">
            {slide.title ?? ''}
          </BrandText>
          <BrandTable
            headers={(slide.data?.headers as string[]) ?? []}
            rows={(slide.data?.rows as string[][]) ?? []}
            dark={dark}
          />
        </>
      )

    case 'cta':
      return (
        <div className="flex flex-col justify-center items-center text-center gap-8 h-full">
          <BrandText variant="heading" dark={dark} className="text-4xl">
            {slide.title ?? ''}
          </BrandText>
          {slide.content && (
            <BrandText variant="body" dark={dark} className="text-xl">
              {slide.content}
            </BrandText>
          )}
          <div
            className="px-8 py-3 rounded-[var(--radius-pill)] font-heading font-bold text-lg uppercase tracking-wider text-white"
            style={{ background: 'var(--red)' }}
          >
            {slide.subtitle ?? 'COMECE AGORA'}
          </div>
        </div>
      )

    default:
      return (
        <>
          {slide.title && (
            <BrandText variant="heading" dark={dark} className="text-3xl">
              {slide.title}
            </BrandText>
          )}
          {slide.content && (
            <BrandText variant="body" dark={dark} className="text-lg">
              {slide.content}
            </BrandText>
          )}
          {slide.items && (
            <ul className="flex flex-col gap-3">
              {slide.items.map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span style={{ color: 'var(--red)' }} className="font-bold">•</span>
                  <BrandText variant="body" dark={dark}>{item}</BrandText>
                </li>
              ))}
            </ul>
          )}
        </>
      )
  }
}

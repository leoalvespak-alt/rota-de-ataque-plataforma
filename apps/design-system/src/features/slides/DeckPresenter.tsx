import { useState, useCallback, useEffect } from 'react'
import type { DeckData, SlideMode } from './types'
import { SlideRenderer } from './SlideRenderer'
import { cn } from '@/lib/utils'

interface DeckPresenterProps {
  deck: DeckData
  mode?: SlideMode
  className?: string
}

export function DeckPresenter({ deck, mode = 'edit', className }: DeckPresenterProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < deck.slides.length) setCurrentSlide(index)
    },
    [deck.slides.length],
  )

  const next = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo])
  const prev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo])

  useEffect(() => {
    if (mode !== 'present') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') setIsFullscreen(false)
      else if (e.key === 'f' || e.key === 'F') {
        void document.documentElement.requestFullscreen?.()
        setIsFullscreen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, next, prev])

  const slide = deck.slides[currentSlide]
  if (!slide) return null

  if (mode === 'overview') {
    return (
      <div className={cn('grid grid-cols-3 gap-4 p-4', className)}>
        {deck.slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentSlide(i)}
            className={cn(
              'relative cursor-pointer border-2 rounded-lg overflow-hidden',
              i === currentSlide ? 'border-[var(--red)]' : 'border-transparent',
            )}
          >
            <SlideRenderer slide={{ ...s, dark: s.dark ?? deck.dark }} zoom={0.15} />
            <div className="absolute bottom-1 right-2 font-numeral text-xs bg-black/60 text-white px-2 py-0.5 rounded">
              {i + 1}
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex justify-center">
        <SlideRenderer
          slide={{ ...slide, dark: slide.dark ?? deck.dark }}
          zoom={mode === 'present' && isFullscreen ? 1 : 0.5}
          exportMode={mode === 'present' && isFullscreen}
        />
      </div>

      <div className="flex items-center justify-between px-4">
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          className="px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider disabled:opacity-30"
          style={{ color: 'var(--ui-text)' }}
        >
          Anterior
        </button>
        <span className="font-numeral text-sm" style={{ color: 'var(--ui-muted)' }}>
          {currentSlide + 1} / {deck.slides.length}
        </span>
        <button
          onClick={next}
          disabled={currentSlide === deck.slides.length - 1}
          className="px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider disabled:opacity-30"
          style={{ color: 'var(--ui-text)' }}
        >
          Proximo
        </button>
      </div>

      {mode === 'edit' && slide.notes && (
        <div className="mx-4 p-3 rounded-lg text-sm" style={{ background: 'var(--ui-panel)', color: 'var(--ui-muted)' }}>
          <span className="font-heading font-bold text-xs uppercase tracking-wider block mb-1" style={{ color: 'var(--red)' }}>
            Notas
          </span>
          {slide.notes}
        </div>
      )}
    </div>
  )
}

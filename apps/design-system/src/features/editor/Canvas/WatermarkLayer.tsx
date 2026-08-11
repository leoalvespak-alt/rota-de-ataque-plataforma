import type { CSSProperties } from 'react'
import { useDecorStore } from '@/stores/useDecorStore'

/** Espelha applyWatermark() do Gerador/index.html original (linha 3069). */
export function WatermarkLayer({ dark }: { dark: boolean }) {
  const watermark = useDecorStore((s) => s.watermark)

  if (!watermark.enabled) return null

  const pad = '24px'
  const positionStyle: CSSProperties =
    watermark.position === 'bottom-right'
      ? { bottom: pad, right: pad }
      : watermark.position === 'bottom-left'
        ? { bottom: pad, left: pad }
        : { bottom: pad, left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        pointerEvents: 'none',
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        fontSize: 28,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: dark ? '#fff' : '#111',
        textShadow: dark
          ? '0 1px 3px rgba(0,0,0,0.95), 0 0 1px rgba(0,0,0,0.9)'
          : '0 1px 3px rgba(255,255,255,0.95), 0 0 1px rgba(255,255,255,0.9)',
        WebkitTextStroke: dark ? '0.35px rgba(0,0,0,0.55)' : '0.35px rgba(255,255,255,0.7)',
        opacity: watermark.opacity,
        ...positionStyle,
      }}
    >
      {watermark.text}
    </div>
  )
}

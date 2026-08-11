import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface BrandDiagramProps {
  definition: string
  dark?: boolean
  className?: string
}

export function BrandDiagram({ definition, dark, className }: BrandDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    const el = containerRef.current
    if (!el) return

    void import('mermaid').then(async (mermaid) => {
      if (!mounted || !el) return
      mermaid.default.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        themeVariables: {
          primaryColor: '#C1121F',
          primaryTextColor: dark ? '#F0F0F0' : '#0A0A0A',
          primaryBorderColor: dark ? '#262626' : '#D4D4CF',
          lineColor: dark ? '#B0B0B0' : '#3D3D3D',
          secondaryColor: '#D4A017',
          tertiaryColor: dark ? '#1F1F1F' : '#EAEAE5',
          fontFamily: "'IBM Plex Sans', sans-serif",
        },
      })
      try {
        const { svg } = await mermaid.default.render(`mermaid-${Date.now()}`, definition)
        if (mounted && el) el.innerHTML = svg
      } catch {
        if (mounted && el) el.textContent = 'Erro ao renderizar diagrama'
      }
    }).catch(() => {
      if (mounted && el) el.textContent = 'Mermaid nao disponivel'
    })

    return () => { mounted = false }
  }, [definition, dark])

  return (
    <div
      ref={containerRef}
      className={cn('flex justify-center p-4', className)}
    />
  )
}

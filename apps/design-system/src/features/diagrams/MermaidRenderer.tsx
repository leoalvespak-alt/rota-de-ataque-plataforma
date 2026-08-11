import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface MermaidRendererProps {
  definition: string
  dark?: boolean
  className?: string
}

export function MermaidRenderer({ definition, dark, className }: MermaidRendererProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    const el = ref.current
    if (!el) return

    void import('mermaid').then(async (mod) => {
      if (!mounted || !el) return
      mod.default.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        themeVariables: {
          primaryColor: '#C1121F',
          primaryTextColor: dark ? '#F0F0F0' : '#0A0A0A',
          primaryBorderColor: dark ? '#262626' : '#D4D4CF',
          lineColor: dark ? '#B0B0B0' : '#3D3D3D',
          fontFamily: "'IBM Plex Sans', sans-serif",
        },
      })
      try {
        const { svg } = await mod.default.render(`mermaid-${Date.now()}`, definition)
        if (mounted && el) el.innerHTML = svg
      } catch {
        if (mounted && el) el.textContent = 'Erro ao renderizar diagrama'
      }
    })

    return () => { mounted = false }
  }, [definition, dark])

  return <div ref={ref} className={cn('flex justify-center', className)} />
}

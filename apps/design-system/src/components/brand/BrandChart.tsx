import { useRef, useEffect, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'

interface BrandChartProps {
  option: EChartsOption
  dark?: boolean
  height?: number | string
  className?: string
  style?: CSSProperties
}

const brandTheme = {
  light: {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', sans-serif", color: '#3D3D3D' },
    title: { textStyle: { fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: '#0A0A0A' } },
    color: ['#C1121F', '#D4A017', '#3B82F6', '#22C55E', '#F59E0B', '#8B0000', '#E33640'],
    categoryAxis: { axisLine: { lineStyle: { color: '#D4D4CF' } }, splitLine: { lineStyle: { color: '#EAEAE5' } } },
    valueAxis: { axisLine: { lineStyle: { color: '#D4D4CF' } }, splitLine: { lineStyle: { color: '#EAEAE5' } } },
  },
  dark: {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', sans-serif", color: '#B0B0B0' },
    title: { textStyle: { fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, color: '#F0F0F0' } },
    color: ['#C1121F', '#D4A017', '#3B82F6', '#22C55E', '#F59E0B', '#E33640', '#8B0000'],
    categoryAxis: { axisLine: { lineStyle: { color: '#262626' } }, splitLine: { lineStyle: { color: '#1F1F1F' } } },
    valueAxis: { axisLine: { lineStyle: { color: '#262626' } }, splitLine: { lineStyle: { color: '#1F1F1F' } } },
  },
}

export function BrandChart({ option, dark, height = 300, className, style }: BrandChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ReturnType<typeof import('echarts')['init']> | null>(null)

  useEffect(() => {
    let mounted = true
    const el = chartRef.current
    if (!el) return

    void import('echarts').then((echarts) => {
      if (!mounted || !el) return
      const theme = dark ? brandTheme.dark : brandTheme.light
      const chart = echarts.init(el)
      chart.setOption({ ...theme, ...option })
      instanceRef.current = chart

      const ro = new ResizeObserver(() => chart.resize())
      ro.observe(el)
      return () => {
        ro.disconnect()
        chart.dispose()
      }
    })

    return () => {
      mounted = false
      instanceRef.current?.dispose()
    }
  }, [option, dark])

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ height, width: '100%', ...style }}
    />
  )
}

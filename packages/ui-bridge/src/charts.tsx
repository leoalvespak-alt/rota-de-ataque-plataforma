'use client'

import React, { useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { EChartsOption } from 'echarts'
import { bridgeTheme } from './echarts-theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false, loading: () => <div className="bridge-skeleton bridge-chart-skeleton" style={{ width: '100%', height: '300px' }} /> })

// Register theme once at module level (client only)
let themeRegistered = false
function ensureTheme() {
  if (themeRegistered || typeof window === 'undefined') return
  import('echarts/core').then((echartsModule: any) => {
    const echarts = echartsModule.default || echartsModule
    echarts.registerTheme('bridge-theme', bridgeTheme)
    themeRegistered = true
  }).catch(() => {})
}

export const ChartContainer = ({ 
  option, 
  height = '300px' 
}: { 
  option: EChartsOption
  height?: string | number
}) => {
  useEffect(() => { ensureTheme() }, [])
  return (
    <div className="bridge-chart-container" style={{ height }}>
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }}
        theme="bridge-theme"
      />
    </div>
  )
}

export const SparklineInline = ({ 
  data, 
  color = 'var(--accent-primary)' 
}: { 
  data: number[]
  color?: string 
}) => {
  if (!data || data.length === 0) return null
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  const width = 60
  const height = 20
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="bridge-sparkline" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

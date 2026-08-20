'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { EChartsOption } from 'echarts'
import { bridgeTheme, chartTokenFallbacks, createBridgeTheme, resolveFallbackChartToken } from './echarts-theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false, loading: () => <div className="bridge-skeleton bridge-chart-skeleton" style={{ width: '100%', height: '300px' }} /> })

type TokenResolver = (token: string, fallback: string) => string

function resolveChartTokens<T>(value: T, resolve: TokenResolver): T {
  if (typeof value === 'string') {
    return value.replace(/var\((--[a-z0-9-]+)(?:,\s*([^)]+))?\)/gi, (_match, token: string, fallback?: string) =>
      resolve(token, fallback?.trim() || chartTokenFallbacks[token] || '#888888')
    ) as T
  }
  if (Array.isArray(value)) return value.map((entry) => resolveChartTokens(entry, resolve)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveChartTokens(entry, resolve)])
    ) as T
  }
  return value
}

export const ChartContainer = ({
  option,
  height = '300px'
}: {
  option: EChartsOption
  height?: string | number
}) => {
  const [chartState, setChartState] = useState(() => ({
    option: resolveChartTokens(option, resolveFallbackChartToken),
    theme: bridgeTheme,
  }))

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    const resolve: TokenResolver = (token, fallback) => styles.getPropertyValue(token).trim() || fallback
    setChartState({
      option: resolveChartTokens(option, resolve),
      theme: createBridgeTheme(resolve),
    })
  }, [option])

  return (
    <div className="bridge-chart-container" style={{ height }}>
      <ReactECharts
        option={chartState.option}
        style={{ height: '100%', width: '100%' }}
        theme={chartState.theme}
        notMerge
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

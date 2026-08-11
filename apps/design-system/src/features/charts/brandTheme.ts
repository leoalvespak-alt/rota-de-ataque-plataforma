import type { EChartsOption } from 'echarts'

export const brandChartColors = [
  '#C1121F', '#D4A017', '#3B82F6', '#22C55E',
  '#F59E0B', '#8B0000', '#E33640', '#6366F1',
]

export function getBrandChartTheme(dark: boolean): Partial<EChartsOption> {
  return {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: "'IBM Plex Sans', sans-serif",
      color: dark ? '#B0B0B0' : '#3D3D3D',
    },
    title: {
      textStyle: {
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700 as const,
        fontSize: 18,
        color: dark ? '#F0F0F0' : '#0A0A0A',
      },
    },
    color: brandChartColors,
    legend: {
      textStyle: {
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: dark ? '#B0B0B0' : '#3D3D3D',
      },
    },
    tooltip: {
      backgroundColor: dark ? '#171717' : '#FFFFFF',
      borderColor: dark ? '#262626' : '#D4D4CF',
      textStyle: {
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: dark ? '#F0F0F0' : '#0A0A0A',
      },
    },
    xAxis: {
      axisLine: { lineStyle: { color: dark ? '#262626' : '#D4D4CF' } },
      axisTick: { lineStyle: { color: dark ? '#262626' : '#D4D4CF' } },
      axisLabel: { color: dark ? '#B0B0B0' : '#3D3D3D' },
      splitLine: { lineStyle: { color: dark ? '#1F1F1F' : '#EAEAE5' } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: dark ? '#262626' : '#D4D4CF' } },
      axisTick: { lineStyle: { color: dark ? '#262626' : '#D4D4CF' } },
      axisLabel: { color: dark ? '#B0B0B0' : '#3D3D3D' },
      splitLine: { lineStyle: { color: dark ? '#1F1F1F' : '#EAEAE5' } },
    },
  }
}

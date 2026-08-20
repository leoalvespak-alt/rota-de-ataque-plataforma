type TokenResolver = (token: string, fallback: string) => string

export const chartTokenFallbacks: Record<string, string> = {
  '--accent-primary': '#e33640',
  '--accent-secondary': '#6ea8fe',
  '--status-success': '#22c55e',
  '--status-warn': '#f59e0b',
  '--status-error': '#ef4444',
  '--status-info': '#60a5fa',
  '--score-high': '#ef4444',
  '--score-med': '#f59e0b',
  '--score-low': '#60a5fa',
  '--surface-card': '#171717',
  '--surface-raised': '#242424',
  '--surface-subtle': '#1f1f1f',
  '--text-primary': '#f0f0f0',
  '--text-secondary': '#b0b0b0',
  '--border-default': '#3d3d3d',
}

export const resolveFallbackChartToken: TokenResolver = (token, fallback) =>
  chartTokenFallbacks[token] ?? fallback

export function createBridgeTheme(resolve: TokenResolver = resolveFallbackChartToken) {
  const token = (name: string) => resolve(name, chartTokenFallbacks[name] ?? '#888888')

  return {
    color: [
      token('--accent-primary'),
      token('--accent-secondary'),
      token('--status-success'),
      token('--status-warn'),
      token('--status-info'),
      token('--score-high'),
      token('--score-med'),
      token('--score-low'),
    ],
    backgroundColor: 'transparent',
    textStyle: { color: token('--text-primary'), fontFamily: 'system-ui, sans-serif' },
    title: {
      textStyle: { color: token('--text-primary'), fontWeight: 700 },
      subtextStyle: { color: token('--text-secondary') },
    },
    line: {
      itemStyle: { borderWidth: 2 },
      lineStyle: { width: 3 },
      symbolSize: 7,
      smooth: true,
    },
    bar: {
      itemStyle: { borderRadius: [8, 8, 3, 3] },
      barMaxWidth: 42,
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: token('--border-default') } },
      axisTick: { show: false },
      axisLabel: { color: token('--text-secondary') },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: token('--text-secondary') },
      splitLine: { lineStyle: { color: token('--border-default'), type: 'dashed', opacity: .48 } },
    },
    legend: {
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: token('--text-secondary') },
    },
    tooltip: {
      backgroundColor: token('--surface-raised'),
      textStyle: { color: token('--text-primary') },
      borderColor: token('--border-default'),
      borderWidth: 1,
      extraCssText: 'border-radius: 12px; box-shadow: 0 14px 40px rgba(0,0,0,0.28);',
    },
    dataZoom: {
      textStyle: { color: token('--text-secondary') },
      borderColor: token('--border-default'),
      fillerColor: `${token('--accent-primary')}22`,
      handleStyle: { color: token('--accent-primary') },
    },
  }
}

export const bridgeTheme = createBridgeTheme()

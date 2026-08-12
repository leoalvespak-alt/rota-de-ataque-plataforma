/**
 * echarts-theme.ts
 * ECharts theme using design system semantic tokens.
 * Register once at app startup: echarts.registerTheme('bridge-theme', bridgeTheme)
 */
import { semanticTokens } from './tokens'

export const bridgeTheme = {
  color: [
    semanticTokens.accentPrimary,
    semanticTokens.accentSecondary,
    semanticTokens.statusSuccess,
    semanticTokens.statusWarn,
    semanticTokens.statusInfo,
    semanticTokens.scoreHigh,
    semanticTokens.scoreMed,
    semanticTokens.scoreLow,
  ],
  backgroundColor: 'transparent',
  textStyle: { color: semanticTokens.textPrimary, fontFamily: 'system-ui, sans-serif' },
  title: {
    textStyle: { color: semanticTokens.textPrimary },
    subtextStyle: { color: semanticTokens.textSecondary },
  },
  line: {
    itemStyle: { borderWidth: 2 },
    smooth: false,
  },
  bar: {
    itemStyle: { borderRadius: 4 },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: semanticTokens.borderDefault } },
    axisTick: { lineStyle: { color: semanticTokens.borderDefault } },
    axisLabel: { color: semanticTokens.textSecondary },
    splitLine: { lineStyle: { color: semanticTokens.borderDefault, type: 'dashed' } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: semanticTokens.textSecondary },
    splitLine: { lineStyle: { color: semanticTokens.borderDefault, type: 'dashed' } },
  },
  legend: {
    textStyle: { color: semanticTokens.textSecondary },
  },
  tooltip: {
    backgroundColor: semanticTokens.surfaceCard,
    textStyle: { color: semanticTokens.textPrimary },
    borderColor: semanticTokens.borderDefault,
    borderWidth: 1,
    extraCssText: 'border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);',
  },
  dataZoom: {
    textStyle: { color: semanticTokens.textSecondary },
    borderColor: semanticTokens.borderDefault,
    fillerColor: `color-mix(in srgb, ${semanticTokens.accentPrimary} 12%, transparent)`,
    handleStyle: { color: semanticTokens.accentPrimary },
  },
}

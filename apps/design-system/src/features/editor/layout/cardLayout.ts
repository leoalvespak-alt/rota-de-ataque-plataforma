import { createContext, createElement, useContext, type ReactNode } from 'react'

export type CardSpacing = 'compact' | 'balanced' | 'comfortable'

export interface CardLayoutSettings {
  autoFit: boolean
  textScale: number
  spacing: CardSpacing
}

export const DEFAULT_CARD_LAYOUT: CardLayoutSettings = {
  autoFit: false,
  textScale: 100,
  spacing: 'balanced',
}

const CardLayoutContext = createContext<CardLayoutSettings>(DEFAULT_CARD_LAYOUT)

export function getCardLayoutSettings(elements: Record<string, unknown>): CardLayoutSettings {
  const raw = elements._layout
  if (!raw || typeof raw !== 'object') return DEFAULT_CARD_LAYOUT
  const candidate = raw as Partial<CardLayoutSettings>
  const spacing = ['compact', 'balanced', 'comfortable'].includes(candidate.spacing ?? '')
    ? candidate.spacing as CardSpacing
    : DEFAULT_CARD_LAYOUT.spacing

  return {
    autoFit: candidate.autoFit === true,
    textScale: typeof candidate.textScale === 'number'
      ? Math.min(120, Math.max(75, candidate.textScale))
      : DEFAULT_CARD_LAYOUT.textScale,
    spacing,
  }
}

export function CardLayoutProvider({
  elements,
  children,
}: {
  elements: Record<string, unknown>
  children: ReactNode
}) {
  return createElement(
    CardLayoutContext.Provider,
    { value: getCardLayoutSettings(elements) },
    children,
  )
}

export function useCardLayout() {
  return useContext(CardLayoutContext)
}

export function getAutoFitFactor(path: string, value: string, availableWidth = 0, baseFontSize = 0) {
  const textLength = value.replace(/<[^>]*>/g, '').trim().length
  if (!textLength || /(^|\.)(page|eyebrow|tag|time|metrics)$/.test(path)) return 1

  const isHeading = /(^|\.)(title|quote|big)$/.test(path)
  const targetLength = isHeading ? 42 : 130
  let factor = Math.sqrt(targetLength / Math.max(targetLength, textLength))

  if (availableWidth > 0 && baseFontSize > 0) {
    const charsPerLine = availableWidth / (baseFontSize * 0.54)
    const estimatedLines = textLength / Math.max(charsPerLine, 1)
    const desiredLines = isHeading ? 3 : 7
    factor = Math.min(factor, Math.sqrt(desiredLines / Math.max(desiredLines, estimatedLines)))
  }

  return Math.max(isHeading ? 0.62 : 0.72, Math.min(1, factor))
}

export function getLineHeight(spacing: CardSpacing, isHeading: boolean) {
  if (spacing === 'balanced') return undefined
  if (isHeading) return spacing === 'compact' ? 0.98 : 1.16
  return spacing === 'compact' ? 1.28 : 1.7
}

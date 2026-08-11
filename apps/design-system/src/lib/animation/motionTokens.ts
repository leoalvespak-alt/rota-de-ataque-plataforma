export const motionTokens = {
  duration: {
    instant: 0.05,
    fast: 0.15,
    normal: 0.25,
    slow: 0.4,
    slower: 0.6,
  },
  easing: {
    default: [0.2, 0, 0, 1] as const,
    spring: { type: 'spring' as const, stiffness: 300, damping: 20 },
    easeIn: [0.4, 0, 1, 1] as const,
    easeOut: [0, 0, 0.2, 1] as const,
  },
} as const

export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: motionTokens.duration.normal },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionTokens.duration.normal, ease: motionTokens.easing.default },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.default },
  },
  springBounce: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: motionTokens.easing.spring,
  },
} as const

export type MotionPreset = keyof typeof motionPresets

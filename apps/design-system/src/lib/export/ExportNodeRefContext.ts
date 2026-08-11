import { createContext, type RefObject } from 'react'

export const ExportNodeRefContext = createContext<RefObject<HTMLDivElement | null>>({
  current: null,
})

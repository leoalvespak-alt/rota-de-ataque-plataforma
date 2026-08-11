import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'

interface FormulaBlockProps {
  expression: string
  displayMode?: boolean
  dark?: boolean
  className?: string
}

export function FormulaBlock({ expression, displayMode = true, dark, className }: FormulaBlockProps) {
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let mounted = true
    void import('katex').then((katex) => {
      if (!mounted) return
      try {
        setHtml(
          katex.default.renderToString(expression, {
            displayMode,
            throwOnError: false,
            output: 'htmlAndMathml',
          }),
        )
      } catch {
        setHtml(`<span style="color: var(--danger)">${expression}</span>`)
      }
    })
    return () => { mounted = false }
  }, [expression, displayMode])

  return (
    <div
      className={cn(
        'rounded-[var(--radius-sm)] p-4',
        dark ? 'bg-[var(--dark-s1)]' : 'bg-[var(--light-bg-alt)]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

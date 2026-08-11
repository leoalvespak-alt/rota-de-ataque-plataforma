import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  language?: string
  dark?: boolean
  className?: string
}

export function CodeBlock({ code, language = 'typescript', dark, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('')

  useEffect(() => {
    let mounted = true
    void import('shiki').then(async (shiki) => {
      if (!mounted) return
      const highlighter = await shiki.createHighlighter({
        themes: ['vitesse-dark', 'vitesse-light'],
        langs: [language],
      })
      const result = highlighter.codeToHtml(code, {
        lang: language,
        theme: dark ? 'vitesse-dark' : 'vitesse-light',
      })
      if (mounted) setHtml(result)
      highlighter.dispose()
    })
    return () => { mounted = false }
  }, [code, language, dark])

  if (!html) {
    return (
      <pre
        className={cn(
          'rounded-[var(--radius-sm)] p-4 overflow-x-auto text-sm',
          dark ? 'bg-[#111] text-[#e0e0e0]' : 'bg-[#fafafa] text-[#1a1a1a]',
          className,
        )}
      >
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      className={cn('rounded-[var(--radius-sm)] overflow-hidden [&_pre]:!p-4 [&_pre]:!m-0 [&_pre]:text-sm', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

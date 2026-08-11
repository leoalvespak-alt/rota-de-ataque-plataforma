import { useEditor, EditorContent } from '@tiptap/react'
import { useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { getProfileConfig, type EditorProfile } from './profiles'

interface BrandEditorProps {
  profile: EditorProfile
  content: string
  onChange: (html: string) => void
  onPlainTextChange?: (text: string) => void
  maxLength?: number
  placeholder?: string
  dark?: boolean
  className?: string
  disabled?: boolean
}

export function BrandEditor({
  profile,
  content,
  onChange,
  onPlainTextChange,
  maxLength,
  placeholder,
  dark,
  className,
  disabled,
}: BrandEditorProps) {
  const config = getProfileConfig(profile, { maxLength, placeholder })

  const editor = useEditor({
    extensions: config.extensions,
    editorProps: config.editorProps as Record<string, unknown>,
    content,
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML())
      onPlainTextChange?.(e.getText())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  const handlePaste = useCallback(
    (_view: unknown, event: ClipboardEvent) => {
      if (profile === 'title') {
        event.preventDefault()
        const text = event.clipboardData?.getData('text/plain') ?? ''
        const sanitized = text.replace(/\n/g, ' ').trim()
        editor?.commands.insertContent(sanitized)
        return true
      }
      return false
    },
    [editor, profile],
  )

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handler = (e: Event) => handlePaste(null, e as ClipboardEvent)
    dom.addEventListener('paste', handler)
    return () => dom.removeEventListener('paste', handler)
  }, [editor, handlePaste])

  const charCount = editor?.storage.characterCount as { characters?: () => number } | undefined
  const currentLength = charCount?.characters?.() ?? 0

  return (
    <div className={cn('relative', className)}>
      <EditorContent
        editor={editor}
        className={cn(
          'min-h-[2em] rounded-[var(--radius-sm)] px-3 py-2 transition-colors',
          dark
            ? 'bg-[var(--dark-s2)] text-[var(--dark-text)] border border-[var(--dark-border)]'
            : 'bg-white text-[var(--light-text)] border border-[var(--light-border)]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      {maxLength && (
        <div
          className={cn(
            'absolute bottom-1 right-2 text-xs font-numeral',
            currentLength > maxLength * 0.9 ? 'text-[var(--danger)]' : 'text-[var(--ui-muted)]',
          )}
        >
          {currentLength}/{maxLength}
        </div>
      )}
    </div>
  )
}

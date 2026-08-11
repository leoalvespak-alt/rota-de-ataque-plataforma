import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import type { Extensions } from '@tiptap/react'

export type EditorProfile = 'title' | 'body' | 'technical'

interface ProfileConfig {
  extensions: Extensions
  editorProps: Record<string, unknown>
}

export function getProfileConfig(
  profile: EditorProfile,
  options?: { maxLength?: number; placeholder?: string },
): ProfileConfig {
  const maxLength = options?.maxLength
  const placeholder = options?.placeholder ?? ''

  const baseExtensions = [
    Placeholder.configure({ placeholder }),
    ...(maxLength ? [CharacterCount.configure({ limit: maxLength })] : []),
  ]

  switch (profile) {
    case 'title':
      return {
        extensions: [
          StarterKit.configure({
            heading: false,
            bulletList: false,
            orderedList: false,
            blockquote: false,
            codeBlock: false,
            code: false,
            horizontalRule: false,
            listItem: false,
          }),
          Highlight.configure({ multicolor: false }),
          ...baseExtensions,
        ],
        editorProps: {
          attributes: {
            class: 'font-heading font-bold uppercase tracking-wide focus:outline-none',
            spellcheck: 'false',
          },
          handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
            if (event.key === 'Enter' && !event.shiftKey) return true
            return false
          },
        },
      }

    case 'body':
      return {
        extensions: [
          StarterKit.configure({
            heading: false,
            codeBlock: false,
          }),
          Highlight,
          Link.configure({ openOnClick: false, autolink: true }),
          Underline,
          ...baseExtensions,
        ],
        editorProps: {
          attributes: {
            class: 'font-body focus:outline-none prose prose-sm max-w-none',
          },
        },
      }

    case 'technical':
      return {
        extensions: [
          StarterKit,
          Highlight.configure({ multicolor: true }),
          Link.configure({ openOnClick: false, autolink: true }),
          Underline,
          ...baseExtensions,
        ],
        editorProps: {
          attributes: {
            class: 'font-body focus:outline-none prose prose-sm max-w-none',
          },
        },
      }
  }
}

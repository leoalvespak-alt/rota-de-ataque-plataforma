import type { ReactNode } from 'react'
import type { TemplateMetadata, SlotDefinition } from './schemas'

interface SlotRendererProps {
  slot: SlotDefinition
  value: unknown
  dark: boolean
  exportMode?: boolean
}

export function SlotRenderer({ slot, value, dark }: SlotRendererProps) {
  if (!value && !slot.required) return null

  switch (slot.type) {
    case 'text':
      return (
        <span data-slot={slot.id} data-slot-type="text">
          {String(value ?? '')}
        </span>
      )
    case 'image':
      return (
        <div
          data-slot={slot.id}
          data-slot-type="image"
          style={{
            backgroundImage: value ? `url(${String(value)})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: dark ? '#1F1F1F' : '#D9D9D4',
          }}
        />
      )
    case 'badge':
      return (
        <span data-slot={slot.id} data-slot-type="badge" className="brand-badge">
          {String(value ?? '')}
        </span>
      )
    case 'divider':
      return <hr data-slot={slot.id} data-slot-type="divider" className="brand-divider" />
    case 'icon':
      return <span data-slot={slot.id} data-slot-type="icon" />
    default:
      return null
  }
}

interface DeclarativeRendererProps {
  metadata: TemplateMetadata
  values: Record<string, unknown>
  dark: boolean
  exportMode?: boolean
  children?: ReactNode
}

export function DeclarativeRenderer({
  metadata,
  values,
  dark,
  children,
}: DeclarativeRendererProps) {
  const slots = metadata.slots ?? []

  return (
    <div
      data-template={metadata.id}
      data-format={metadata.format}
      data-filter={metadata.filter}
      data-dark={dark}
    >
      {slots.map((slot) => (
        <SlotRenderer
          key={slot.id}
          slot={slot}
          value={values[slot.id]}
          dark={dark}
        />
      ))}
      {children}
    </div>
  )
}

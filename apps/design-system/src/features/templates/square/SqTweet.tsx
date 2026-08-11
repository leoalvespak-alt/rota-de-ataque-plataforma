import type { TemplateRenderProps, TemplateControlsProps } from '../types'
import { TSlot } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useSlotFilePicker } from '../useSlotFilePicker'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ImageUploadField } from '@/features/editor/ControlPanel/ImageUploadField'
import { useImageSlot } from '../useImageSlot'

export interface SqTweetElements {
  name: string
  handle: string
  body: string
  time: string
  metrics: string
  avatar?: string
  bgImg?: string
}

/** Espelha renderTweetSquare() do Gerador/index.html (linha 2398). */
export function SqTweetRender({ elements: el, dark }: TemplateRenderProps<SqTweetElements>) {
  const onSlotClick = useSlotFilePicker()
  return (
    <div className="relative z-2 flex h-full flex-col items-center justify-center p-22.5">
      <div
        className="flex w-full flex-col gap-7.5 rounded-3xl border p-12.5"
        style={{
          background: 'var(--light-bg)',
          borderColor: 'var(--light-border)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-5">
          {/* Nota de fidelidade: .t-slot reage a #card-canvas.dark no original mesmo dentro
              do card sempre-light do tweet (renderTweetSquare, linha 2405) — comportamento
              replicado tal como é, não uma escolha nova desta migração. */}
          <TSlot
            slotId="avatar"
            imageUrl={el.avatar}
            onClick={onSlotClick}
            dark={dark}
            label="FOTO"
            className="h-20 w-20 shrink-0 rounded-full"
          />
          <div>
            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--light-text)',
                lineHeight: 1.2,
              }}
            >
              <EditableText path="name" value={el.name} />
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 26,
                color: 'var(--light-muted)',
              }}
            >
              <EditableText path="handle" value={el.handle} />
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 42,
            fontWeight: 400,
            color: 'var(--light-text)',
            lineHeight: 1.4,
          }}
        >
          <EditableText path="body" value={el.body} />
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 24,
            color: 'var(--light-muted)',
          }}
        >
          <EditableText path="time" value={el.time} />
        </div>
        <div className="h-px w-full" style={{ background: 'var(--light-border)' }} />
        <div
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 24,
            color: 'var(--light-muted)',
            fontWeight: 600,
          }}
        >
          <EditableText path="metrics" value={el.metrics} />
        </div>
      </div>
    </div>
  )
}

/** Espelha buildTweetControls() do Gerador/index.html (linha 2664). */
export function SqTweetControls(_props: TemplateControlsProps<SqTweetElements>) {
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const handleBgImg = useImageSlot('bgImg')

  return (
    <>
      <ControlSection title="Imagem de Fundo">
        <ControlRow label="Background Opcional">
          <ImageUploadField onFileSelected={handleBgImg} />
        </ControlRow>
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle
          label="Modo Escuro (Card)"
          checked={darkMode}
          onCheckedChange={toggleDarkMode}
        />
      </ControlSection>
    </>
  )
}

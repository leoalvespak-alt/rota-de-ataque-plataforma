import type { TemplateRenderProps, TemplateControlsProps } from '../types'
import { TEyebrow, TRedline, TPageIndicator } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { CrCoverControls, type CrCoverElements } from './CrCover'

export type CrCoverDarkElements = CrCoverElements

/**
 * Espelha renderCarouselCoverDark() do Gerador/index.html (linha 2522).
 * Corrige a auditoria item 9: o original duplicava manualmente
 * `<div class="canvas-texture"></div><div class="canvas-accent"></div>` em vez de
 * reusar baseTexture() — aqui não há duplicação possível porque CanvasFrame
 * (Fase 2) já é o único lugar que desenha textura+accent para todo template.
 */
export function CrCoverDarkRender({ elements: el }: TemplateRenderProps<CrCoverDarkElements>) {
  const hasImg = Boolean(el.bgImg)
  return (
    <>
      {hasImg ? (
        <img src={el.bgImg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 z-0" style={{ background: '#0A0A0A' }} />
      )}
      {hasImg && (
        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{ background: 'rgba(0,0,0,0.65)' }}
        />
      )}
      <div className="relative z-3 flex h-full flex-col items-start justify-end gap-6 p-[90px]">
        {el.eyebrow !== false && (
          <TEyebrow fontSize={24}>
            <EditableText path="eyebrow" value={el.eyebrow} />
          </TEyebrow>
        )}
        <div
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: 86,
            color: '#fff',
            lineHeight: 1.05,
          }}
        >
          <EditableText path="title" value={el.title} />
        </div>
        <TRedline />
        {el.subtitle !== false && (
          <div
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 34,
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            <EditableText path="subtitle" value={el.subtitle} />
          </div>
        )}
      </div>
      <div className="absolute right-[90px] bottom-[90px] z-5">
        <TPageIndicator fontSize={28}>
          <EditableText path="page" value={el.page} />
        </TPageIndicator>
      </div>
    </>
  )
}

/** Reusa CrCoverControls — buildCarouselCoverControls() também atende cr-cover-dark no original. */
export const CrCoverDarkControls = (props: TemplateControlsProps<CrCoverDarkElements>) =>
  CrCoverControls(props)

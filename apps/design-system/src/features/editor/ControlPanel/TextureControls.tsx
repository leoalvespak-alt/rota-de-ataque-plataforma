import { useDecorStore, type TextureType } from '@/stores/useDecorStore'
import { getTextureSVG } from '@/lib/textures'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlToggle } from './ControlToggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

/**
 * Espelha buildTextureControls() do Gerador/index.html original (linha 3257).
 * Corrige a auditoria item 3: o toggle "Ativada" usava markup sem CSS no original —
 * aqui usa o mesmo <ControlToggle> (shadcn Switch) do resto do app.
 */
export function TextureControls() {
  const texture = useDecorStore((s) => s.texture)
  const darkMode = useEditorStore((s) => s.darkMode)
  const setTexture = useDecorStore((s) => s.setTexture)
  const toggleTexture = useDecorStore((s) => s.toggleTexture)
  const setTextureOpacity = useDecorStore((s) => s.setTextureOpacity)

  const showSlider = texture.type !== 'none'

  return (
    <div className="mt-2 border-t-2 border-brand-red/20 px-4 pt-4 pb-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-brand-red uppercase">
        Textura de Fundo
      </div>
      <div className="flex flex-col gap-2.5">
        <div>
          <span className="mb-1.5 block text-xs text-ui-muted">Tipo</span>
          <Select value={texture.type} onValueChange={(v) => setTexture(v as TextureType)}>
            <SelectTrigger className="w-full text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="organic">Orgânico — Linhas</SelectItem>
              <SelectItem value="noise">Ruído / Grão</SelectItem>
              <SelectItem value="hatching">Hatching Tático ★</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showSlider && (
          <>
            <ControlToggle label="Ativada" checked={texture.enabled} onCheckedChange={toggleTexture} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-ui-muted">Opacidade</span>
              <Slider
                min={2}
                max={25}
                step={1}
                value={[Math.round(texture.opacity * 100)]}
                onValueChange={([v]) => v !== undefined && setTextureOpacity(v)}
                className="flex-1"
              />
              <span className="min-w-7.5 text-right text-[11px] text-ui-muted">
                {Math.round(texture.opacity * 100)}%
              </span>
            </div>
            <div className="rounded-lg border border-ui-border bg-ui-panel p-2.5">
              <div className="mb-1.5 text-[10px] tracking-[0.08em] text-ui-muted uppercase">Preview</div>
              <div
                className="relative h-10 overflow-hidden rounded-md"
                style={{ background: darkMode ? '#0A0A0A' : '#F5F5F0' }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: getTextureSVG(texture.type, darkMode),
                    backgroundRepeat: 'repeat',
                    opacity: texture.enabled ? texture.opacity : 0,
                  }}
                />
              </div>
            </div>
          </>
        )}
        {!showSlider && (
          <div className="text-[11px] leading-relaxed text-ui-muted">
            Selecione um tipo para ativar a textura no card.
          </div>
        )}
      </div>
    </div>
  )
}

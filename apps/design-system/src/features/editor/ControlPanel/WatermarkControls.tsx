import { useDecorStore, type WatermarkPosition } from '@/stores/useDecorStore'
import { ControlToggle } from './ControlToggle'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

/** Espelha buildWatermarkControls() do Gerador/index.html original (linha 3095). */
export function WatermarkControls() {
  const watermark = useDecorStore((s) => s.watermark)
  const setWatermarkEnabled = useDecorStore((s) => s.setWatermarkEnabled)
  const setWatermarkText = useDecorStore((s) => s.setWatermarkText)
  const setWatermarkPosition = useDecorStore((s) => s.setWatermarkPosition)
  const setWatermarkOpacity = useDecorStore((s) => s.setWatermarkOpacity)

  return (
    <div className="mt-2 border-t-2 border-brand-red/20 px-4 pt-4 pb-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-brand-red uppercase">
        Marca D'água
      </div>
      <ControlToggle label="Mostrar" checked={watermark.enabled} onCheckedChange={setWatermarkEnabled} />
      {watermark.enabled && (
        <div className="flex flex-col gap-3">
          <div>
            <span className="mb-1.5 block text-xs text-ui-muted">Texto</span>
            <Input value={watermark.text} onChange={(e) => setWatermarkText(e.target.value)} className="text-[13px]" />
          </div>
          <div>
            <span className="mb-1.5 block text-xs text-ui-muted">Posição</span>
            <Select value={watermark.position} onValueChange={(v) => setWatermarkPosition(v as WatermarkPosition)}>
              <SelectTrigger className="w-full text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">Canto Inferior Direito</SelectItem>
                <SelectItem value="bottom-left">Canto Inferior Esquerdo</SelectItem>
                <SelectItem value="bottom-center">Centro Inferior</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ui-muted">Opacidade</span>
            <Slider
              min={20}
              max={100}
              step={5}
              value={[Math.round(watermark.opacity * 100)]}
              onValueChange={([v]) => v !== undefined && setWatermarkOpacity(v)}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { toast } from 'sonner'
import { useAIStore } from '@/stores/useAIStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { generateImage } from '@/lib/ai/generateImage'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { HeaderPrimaryButton, HeaderSecondaryButton } from '@/app/HeaderButtons'
import { createIdempotencyKey } from '@/lib/api/idempotency'

const STYLE_OPTIONS = [
  { value: 'tático militar, tons escuros, vermelho e preto, alta definição', label: 'Tático / Militar' },
  { value: 'minimalista, fundo claro, linhas geométricas limpas', label: 'Minimalista Claro' },
  { value: 'fotográfico, profissional, iluminação dramática', label: 'Fotográfico' },
  { value: 'abstrato, gradiente, formas geométricas', label: 'Abstrato / Gradiente' },
  { value: '', label: 'Sem estilo adicional' },
]

/** Espelha buildAIImageControls()/generateImage() do Gerador/index.html original (linha 4291). */
export function AIImageControls() {
  const imageModel = useAIStore((s) => s.getActiveImageModel())
  const generatedImageUrl = useAIStore((s) => s.generatedImageUrl)
  const setGeneratedImageUrl = useAIStore((s) => s.setGeneratedImageUrl)
  const setElementField = useEditorStore((s) => s.setElementField)

  const [promptText, setPromptText] = useState('')
  const [style, setStyle] = useState(STYLE_OPTIONS[0]!.value)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  if (!imageModel?.configured) {
    return (
      <div className="border-b border-ui-border px-4 py-3.5">
        <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase">
          🎨 Gerar Imagem de Fundo
        </div>
        <div className="py-2 text-center text-[11px] text-ui-muted">
          Configure o provider de imagem no servidor.
        </div>
      </div>
    )
  }

  const handleGenerate = async () => {
    if (!promptText.trim()) {
      toast.error('Digite uma descrição para a imagem.')
      return
    }
    setLoading(true)
    setStatus('Gerando imagem... (~5-10s)')
    try {
      const url = await generateImage({
        model: imageModel.id,
        promptText,
        style,
        idempotencyKey: createIdempotencyKey('editor-image', promptText, style),
        onStatus: setStatus,
      })
      setGeneratedImageUrl(url)
      setStatus('Imagem gerada. Revisar antes de aplicar.')
    } catch (err) {
      console.error('fal.ai error:', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setStatus(`Erro: ${msg}`)
      toast.error('Erro ao gerar imagem. Verifique a chave e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const applyGeneratedImage = () => {
    if (!generatedImageUrl) return
    setElementField(['bgImg'], generatedImageUrl)
    setGeneratedImageUrl(null)
    setStatus('Imagem aplicada como fundo.')
    toast.success('Imagem aplicada ao card.')
  }

  const discardGeneratedImage = () => {
    setGeneratedImageUrl(null)
    setStatus('')
  }

  return (
    <div className="border-b border-ui-border px-4 py-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase">
        🎨 Gerar Imagem de Fundo
      </div>

      <div className="mb-3">
        <span className="mb-1.5 block text-xs text-ui-muted">Descrição da imagem</span>
        <Textarea
          rows={3}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Ex: mapa do Brasil com marcações táticas militares, fundo escuro, estética de operação"
        />
      </div>

      <div className="mb-3">
        <span className="mb-1.5 block text-xs text-ui-muted">Estilo</span>
        <Select value={style} onValueChange={setStyle}>
          <SelectTrigger className="w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLE_OPTIONS.map((s) => (
              <SelectItem key={s.label} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <HeaderPrimaryButton className="w-full justify-center" disabled={loading} onClick={handleGenerate}>
        {loading ? 'Gerando...' : 'Gerar Imagem'}
      </HeaderPrimaryButton>

      {status && <div className="mt-2 min-h-4 text-[11px] text-ui-muted">{status}</div>}

      {generatedImageUrl && (
        <div className="mt-2.5">
          <img src={generatedImageUrl} className="w-full rounded-md border border-ui-border" alt="" />
          <div className="mt-1.5 flex gap-1.5">
            <HeaderPrimaryButton className="flex-1 justify-center text-xs" onClick={applyGeneratedImage}>
              ✓ Usar no Card
            </HeaderPrimaryButton>
            <HeaderSecondaryButton className="flex-1 justify-center text-xs" onClick={discardGeneratedImage}>
              ✕ Descartar
            </HeaderSecondaryButton>
          </div>
        </div>
      )}
    </div>
  )
}

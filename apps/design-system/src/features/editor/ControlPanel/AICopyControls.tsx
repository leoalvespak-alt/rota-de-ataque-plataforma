import { useState } from 'react'
import { toast } from 'sonner'
import { useAIStore } from '@/stores/useAIStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { generateCopy } from '@/lib/ai/generateCopy'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { HeaderPrimaryButton } from '@/app/HeaderButtons'

const CAREER_OPTIONS = [
  { value: 'fiscal', label: 'Fiscal / Receita / SEFAZ' },
  { value: 'policial', label: 'Policial / PF / PRF / PC' },
  { value: 'tribunal', label: 'Tribunal / TRF / TCU / TCE' },
  { value: 'geral', label: 'Geral / Outro' },
] as const

/** Espelha buildAICopyControls()/generateCopy() do Gerador/index.html original (linha 4103). */
export function AICopyControls() {
  const models = useAIStore((s) => s.models)
  const copyModel = useAIStore((s) => s.copyModel)
  const setCopyModel = useAIStore((s) => s.setCopyModel)
  const elements = useEditorStore((s) => s.elements)
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId)
  const setElementField = useEditorStore((s) => s.setElementField)

  const [prompt, setPrompt] = useState('')
  const [career, setCareer] = useState<(typeof CAREER_OPTIONS)[number]['value']>('fiscal')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const enabledModels = models.filter((m) => m.enabled)
  const selectedModel = models.find((m) => m.id === copyModel) ?? enabledModels[0]
  const unavailable = !selectedModel?.configured

  const handleGenerate = async () => {
    if (!selectedModel) {
      toast.error('Nenhum modelo configurado. Adicione um na aba ⚙ AI.')
      return
    }
    if (!selectedModel.configured) {
      toast.error(`O modelo "${selectedModel.label}" não está configurado no servidor.`)
      return
    }
    if (!activeTemplateId) {
      toast.error('Selecione um template primeiro.')
      return
    }
    if (!prompt.trim()) {
      toast.error('Digite uma descrição para o post.')
      return
    }

    const availableFields = Object.keys(elements).filter(
      (k) => typeof elements[k] === 'string' && k !== 'bgImg',
    )

    setLoading(true)
    setStatus('Gerando...')
    try {
      const parsed = await generateCopy({
        model: selectedModel,
        prompt,
        career,
        availableFields,
      })

      let applied = 0
      for (const key of Object.keys(parsed)) {
        if (key in elements && typeof parsed[key] === 'string') {
          setElementField([key], parsed[key])
          applied++
        }
      }
      if (applied === 0) throw new Error('Nenhum campo reconhecido na resposta.')

      toast.success(`Copy gerado — ${applied} campos atualizados.`)
      setStatus('')
    } catch (err) {
      console.error('AI Copy error:', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setStatus(`Erro: ${msg}`)
      toast.error('Erro ao gerar copy. Verifique a chave e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-ui-border px-4 py-3.5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-ui-muted uppercase">
        ✦ Gerar Texto com AI
      </div>

      <div className="mb-3">
        <span className="mb-1.5 block text-xs text-ui-muted">Modelo de Copy</span>
        <Select value={selectedModel?.id ?? ''} onValueChange={setCopyModel}>
          <SelectTrigger className="w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enabledModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {unavailable && (
        <div className="mb-2 text-center text-[11px] leading-relaxed text-ui-muted">
          O modelo <strong className="text-brand-red">{selectedModel?.label ?? 'selecionado'}</strong> precisa ser configurado no servidor.
        </div>
      )}

      <div className="mb-3">
        <span className="mb-1.5 block text-xs text-ui-muted">Descreva o post</span>
        <Textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: post sobre SEFAZ-CE 2026, foco em Auditores Fiscais, tom tático e urgente"
        />
      </div>

      <div className="mb-3">
        <span className="mb-1.5 block text-xs text-ui-muted">Carreira / Contexto</span>
        <Select value={career} onValueChange={(v) => setCareer(v as typeof career)}>
          <SelectTrigger className="w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAREER_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <HeaderPrimaryButton
        className="w-full justify-center"
        disabled={unavailable || loading}
        onClick={handleGenerate}
      >
        {loading ? 'Gerando...' : 'Gerar Copy'}
      </HeaderPrimaryButton>

      {status && <div className="mt-2 min-h-4 text-[11px] text-ui-muted">{status}</div>}
    </div>
  )
}

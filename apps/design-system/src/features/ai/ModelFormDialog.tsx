import { useState } from 'react'
import { useAIStore, type AIModel, type AIProviderKind } from '@/stores/useAIStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HeaderPrimaryButton, HeaderSecondaryButton } from '@/app/HeaderButtons'

const DEFAULT_URLS: Record<AIProviderKind, string> = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  'openai-compat': '',
}

/**
 * Espelha o modal de modelos do Gerador/index.html original (#model-modal, linha 4461;
 * openAddModelModal/openEditModelModal/saveModelModal, linhas 3922-4009).
 *
 * 🆕 Resolve a dívida D6 da auditoria (item 10): campo "Chave própria (opcional)" —
 * o original só permitia reaproveitar deepseekKey/claudeKey/falKey; aqui um modelo
 * customizado pode ter sua própria chave sem precisar "emprestar" o campo de outro provedor.
 */
export function ModelFormDialog({
  editingId,
  onClose,
}: {
  editingId: string | null
  onClose: () => void
}) {
  const models = useAIStore((s) => s.models)
  const editing = editingId ? models.find((m) => m.id === editingId) : null

  return (
    <ModelForm
      key={editingId ?? 'closed'}
      editing={editing}
      isOpen={editingId !== null}
      onClose={onClose}
    />
  )
}

function ModelForm({
  editing,
  isOpen,
  onClose,
}: {
  editing: AIModel | null | undefined
  isOpen: boolean
  onClose: () => void
}) {
  const addModel = useAIStore((s) => s.addModel)
  const updateModel = useAIStore((s) => s.updateModel)

  const [label, setLabel] = useState(editing?.label ?? '')
  const [provider, setProvider] = useState<AIProviderKind>(editing?.provider ?? 'deepseek')
  const [model, setModel] = useState(editing?.model ?? '')
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? DEFAULT_URLS.deepseek)
  const [keyRef, setKeyRef] = useState<AIModel['keyRef']>(editing?.keyRef ?? 'deepseekKey')
  const [customKey, setCustomKey] = useState(editing?.customKey ?? '')
  const [error, setError] = useState('')

  const handleProviderChange = (v: AIProviderKind) => {
    setProvider(v)
    if (!baseUrl || Object.values(DEFAULT_URLS).includes(baseUrl)) {
      setBaseUrl(DEFAULT_URLS[v])
    }
  }

  const handleSave = () => {
    if (!label.trim()) return setError('Nome de exibição obrigatório.')
    if (!model.trim()) return setError('String do modelo obrigatória.')

    const resolvedUrl =
      baseUrl.trim() || DEFAULT_URLS[provider === 'claude' ? 'claude' : 'deepseek']

    const payload = {
      label: label.trim(),
      model: model.trim(),
      provider,
      keyRef,
      baseUrl: resolvedUrl,
      customKey: customKey.trim() || undefined,
    }

    if (editing) {
      updateModel(editing.id, payload)
    } else {
      addModel({ ...payload, enabled: true })
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Modelo' : 'Adicionar Modelo'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block">Nome de exibição</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: DeepSeek R2 — Rápido"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Formato da API</Label>
            <Select
              value={provider}
              onValueChange={(v) => handleProviderChange(v as AIProviderKind)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepseek">
                  OpenAI-compat (DeepSeek, Groq, Together, etc.)
                </SelectItem>
                <SelectItem value="openai-compat">OpenAI-compat (URL customizada)</SelectItem>
                <SelectItem value="claude">Anthropic Messages API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">String do modelo</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex: deepseek-chat / claude-sonnet-4-6 / llama3-70b-8192"
            />
          </div>
          {provider === 'openai-compat' && (
            <div>
              <Label className="mb-1.5 block">Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.exemplo.com/v1/chat/completions"
              />
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">Usar qual chave</Label>
            <Select value={keyRef} onValueChange={(v) => setKeyRef(v as AIModel['keyRef'])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepseekKey">DeepSeek Key</SelectItem>
                <SelectItem value="claudeKey">Claude Key</SelectItem>
                <SelectItem value="falKey">fal.ai Key (não recomendado para copy)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">
              Chave própria (opcional)
              <span className="ml-1.5 text-[11px] font-normal text-ui-muted">
                — tem prioridade sobre a chave selecionada acima
              </span>
            </Label>
            <Input
              type="password"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="Deixe em branco para usar a chave selecionada"
            />
          </div>
          {error && <div className="text-[11px] text-red-500">{error}</div>}
        </div>
        <DialogFooter>
          <HeaderSecondaryButton onClick={onClose}>Cancelar</HeaderSecondaryButton>
          <HeaderPrimaryButton onClick={handleSave}>Salvar</HeaderPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from 'react'
import { useAIStore } from '@/stores/useAIStore'
import { Input } from '@/components/ui/input'
import { HeaderSecondaryButton } from '@/app/HeaderButtons'
import { ModelsList } from './ModelsList'
import { ModelFormDialog } from './ModelFormDialog'
import { AICostPanel } from './AICostPanel'

/** Espelha #ai-config-view do Gerador/index.html original (linhas 1857-1939). */
export function AIConfigView() {
  const deepseekKey = useAIStore((s) => s.deepseekKey)
  const claudeKey = useAIStore((s) => s.claudeKey)
  const falKey = useAIStore((s) => s.falKey)
  const setKey = useAIStore((s) => s.setKey)

  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<'closed' | 'add' | 'edit'>('closed')
  const [showKeys, setShowKeys] = useState({ deepseek: false, claude: false, fal: false })

  return (
    <div className="flex-1 overflow-y-auto bg-ui-bg text-ui-text">
      <div className="mx-auto max-w-[520px] px-6 py-12">
        <div className="mb-1.5 font-heading text-[28px] font-bold tracking-[0.04em] uppercase">
          Configuração de AI
        </div>
        <p className="mb-8 text-[13px] leading-relaxed text-ui-muted">
          As chaves ficam salvas apenas no seu navegador (localStorage). Nunca são enviadas para
          nenhum servidor externo além das próprias APIs.
        </p>

        <KeyField
          label="DeepSeek API Key"
          hint="— para geração de copy e textos"
          value={deepseekKey}
          onChange={(v) => setKey('deepseekKey', v)}
          visible={showKeys.deepseek}
          onToggleVisible={() => setShowKeys((s) => ({ ...s, deepseek: !s.deepseek }))}
          docsUrl="https://platform.deepseek.com"
          docsLabel="platform.deepseek.com"
          modelHint="deepseek-chat"
        />

        <KeyField
          label="Claude API Key"
          hint="— alternativa para geração de copy"
          value={claudeKey}
          onChange={(v) => setKey('claudeKey', v)}
          visible={showKeys.claude}
          onToggleVisible={() => setShowKeys((s) => ({ ...s, claude: !s.claude }))}
          docsUrl="https://console.anthropic.com/settings/keys"
          docsLabel="console.anthropic.com"
          modelHint="claude-sonnet-4-6"
        />

        <KeyField
          label="fal.ai API Key"
          hint="— para geração de imagens de fundo"
          value={falKey}
          onChange={(v) => setKey('falKey', v)}
          visible={showKeys.fal}
          onToggleVisible={() => setShowKeys((s) => ({ ...s, fal: !s.fal }))}
          docsUrl="https://fal.ai/dashboard/keys"
          docsLabel="fal.ai/dashboard/keys"
          modelHint="fal-ai/flux/schnell"
        />

        <div className="mt-8 border-t border-ui-border pt-7">
          <AICostPanel />
        </div>

        <div className="mt-8 border-t border-ui-border pt-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-heading text-lg font-bold tracking-[0.04em] uppercase">Modelos de Copy</div>
              <div className="mt-0.5 text-[11px] text-ui-muted">
                Edite, reordene ou adicione modelos compatíveis com OpenAI ou Anthropic.
              </div>
            </div>
            <HeaderSecondaryButton className="whitespace-nowrap" onClick={() => setDialogMode('add')}>
              + Adicionar
            </HeaderSecondaryButton>
          </div>
          <ModelsList
            onEdit={(id) => {
              setEditingModelId(id)
              setDialogMode('edit')
            }}
          />
        </div>
      </div>

      <ModelFormDialog
        editingId={dialogMode === 'edit' ? editingModelId : dialogMode === 'add' ? 'new' : null}
        onClose={() => setDialogMode('closed')}
      />
    </div>
  )
}

function KeyField({
  label,
  hint,
  value,
  onChange,
  visible,
  onToggleVisible,
  docsUrl,
  docsLabel,
  modelHint,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  visible: boolean
  onToggleVisible: () => void
  docsUrl: string
  docsLabel: string
  modelHint: string
}) {
  return (
    <div className="mb-6">
      <label className="mb-2 block text-[13px]">
        {label}
        <span className="ml-1.5 text-[11px] font-normal text-ui-muted">{hint}</span>
      </label>
      <div className="flex gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
          className="flex-1"
        />
        <HeaderSecondaryButton type="button" onClick={onToggleVisible}>
          👁
        </HeaderSecondaryButton>
      </div>
      <div className="mt-1.5 text-[11px] text-ui-muted">
        Obter em:{' '}
        <a href={docsUrl} target="_blank" rel="noreferrer" className="text-brand-red">
          {docsLabel}
        </a>{' '}
        — use o modelo <code className="rounded bg-ui-panel2 px-1 py-0.5">{modelHint}</code>
      </div>
    </div>
  )
}

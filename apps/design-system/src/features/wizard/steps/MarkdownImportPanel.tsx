import { useRef, useState } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { generateMarkdownTemplate, downloadMarkdownTemplate } from '@/lib/markdown/generateMarkdownTemplate'
import {
  parseMarkdownScript,
  parsedCardsToScriptCards,
  validateParsedCards,
  MarkdownParseError,
} from '@/lib/markdown/parseMarkdownScript'
import { cn } from '@/lib/utils'
import { Download, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'

export function MarkdownImportPanel() {
  const aspectRatio = useWizardStore((s) => s.aspectRatio)
  const cardCount = useWizardStore((s) => s.cardCount)
  const creativeType = useWizardStore((s) => s.creativeType)
  const setScriptCards = useWizardStore((s) => s.setScriptCards)

  const effectiveCardCount = creativeType === 'carousel' ? cardCount : 1
  const canDownload = !!aspectRatio && effectiveCardCount >= 1

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [success, setSuccess] = useState(false)

  const handleDownload = () => {
    if (!canDownload) return
    const content = generateMarkdownTemplate({
      aspectRatio: aspectRatio!,
      cardCount: effectiveCardCount,
    })
    const ratioLabel = aspectRatio === 'portrait' ? 'retrato' : 'quadrado'
    downloadMarkdownTemplate(content, `roteiro_${ratioLabel}_${effectiveCardCount}cards.md`)
  }

  const processFile = async (file: File) => {
    setError(null)
    setWarnings([])
    setSuccess(false)

    if (file.size > 1_048_576) {
      setError('Arquivo muito grande. O limite é 1 MB.')
      return
    }

    const allowedExtensions = ['.md', '.markdown', '.txt']
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      setError('Formato não suportado. Use .md, .markdown ou .txt.')
      return
    }

    setFileName(file.name)

    try {
      const content = await file.text()
      const parsed = parseMarkdownScript(content)
      const warns = validateParsedCards(parsed, effectiveCardCount)
      const cards = parsedCardsToScriptCards(parsed)
      setScriptCards(cards)
      setWarnings(warns)
      setSuccess(true)
    } catch (err) {
      if (err instanceof MarkdownParseError) {
        setError(err.message)
      } else {
        setError('Erro ao ler o arquivo. Verifique se está no formato correto.')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={handleDownload}
          disabled={!canDownload}
          title={!canDownload ? 'Selecione o formato e a quantidade de cards primeiro' : undefined}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all',
            canDownload
              ? 'border-brand-red bg-brand-red/5 text-brand-red hover:bg-brand-red/10'
              : 'cursor-not-allowed border-ui-border bg-ui-panel text-ui-muted opacity-50',
          )}
        >
          <Download className="size-4" />
          Baixar Formato Esperado (.md)
        </button>
        {!canDownload && (
          <p className="mt-1.5 text-center text-xs text-ui-muted">
            Selecione o formato e a quantidade de cards no Step 1 primeiro.
          </p>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-all',
          dragging
            ? 'border-brand-red bg-brand-red/5'
            : 'border-ui-border bg-ui-panel hover:border-brand-red/50 hover:bg-ui-panel2',
        )}
      >
        <Upload className={cn('size-8', dragging ? 'text-brand-red' : 'text-ui-muted')} />
        <div className="text-center">
          <div className="text-sm font-medium text-ui-text">
            {fileName ? `Arquivo: ${fileName}` : 'Arraste o .md preenchido ou clique para selecionar'}
          </div>
          <div className="mt-1 text-xs text-ui-muted">Aceita .md, .markdown, .txt — máx. 1 MB</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-400">
              Roteiro importado com sucesso!
            </p>
            {warnings.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-yellow-400">
                    <FileText className="mt-0.5 size-3 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import type { TemplateDefinition, FieldDef } from '../types'
import { ControlRow } from '@/features/editor/ControlPanel/ControlRow'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { Input } from '@/components/ui/input'
import type { TemplateControlsProps } from '../types'
import { SpecComposition, type SpecElements, type SpecLayout } from './SpecComposition'

interface SpecDefinition {
  id: SpecLayout
  name: string
  format: 'feed' | 'portrait'
}

export const NEW_SPEC_DEFINITIONS: SpecDefinition[] = [
  { id: 'feed-editorial-column', name: 'Coluna editorial', format: 'feed' },
  { id: 'feed-proof-macro', name: 'Prova em macro', format: 'feed' },
  { id: 'feed-method-map', name: 'Mapa de método', format: 'feed' },
  { id: 'feed-decision-tree', name: 'Árvore de decisão', format: 'feed' },
  { id: 'feed-side-by-side', name: 'Comparação aberta', format: 'feed' },
  { id: 'feed-open-sequence', name: 'Sequência contínua', format: 'feed' },
  { id: 'feed-exam-anatomy', name: 'Anatomia de questão', format: 'feed' },
  { id: 'feed-date-line', name: 'Linha do tempo', format: 'feed' },
  { id: 'feed-mistake-diagnosis', name: 'Diagnóstico de erro', format: 'feed' },
  { id: 'feed-principle-rule', name: 'Regra e condição', format: 'feed' },
  { id: 'feed-annotated-example', name: 'Exemplo anotado', format: 'feed' },
  { id: 'feed-single-cta', name: 'Convite com respiro', format: 'feed' },
  { id: 'story-entry-any-frame', name: 'Story com referente', format: 'portrait' },
  { id: 'story-scenario-branch', name: 'Story por cenário', format: 'portrait' },
  { id: 'story-step-rail', name: 'Story de procedimento', format: 'portrait' },
  { id: 'story-source-focus', name: 'Story com fonte em foco', format: 'portrait' },
  { id: 'story-answer-ladder', name: 'Story de resposta progressiva', format: 'portrait' },
  { id: 'story-action-safe-zone', name: 'Story com ação em área segura', format: 'portrait' },
  { id: 'carousel-case-walkthrough', name: 'Caso hipotético explicado', format: 'feed' },
  { id: 'carousel-evidence-led', name: 'Carrossel guiado por prova', format: 'feed' },
  { id: 'carousel-decision-path', name: 'Percurso de decisão', format: 'feed' },
  { id: 'carousel-misconception-check', name: 'Checagem de equívoco', format: 'feed' },
  { id: 'carousel-comparison-matrix', name: 'Matriz comparativa', format: 'feed' },
  { id: 'carousel-application-lab', name: 'Aplicação guiada', format: 'feed' },
]

const placeholder = '[Campo a preencher com conteúdo verificado]'

export function createSpecDefaults(id: SpecLayout): SpecElements {
  return {
    eyebrow: id === 'carousel-case-walkthrough' ? 'SITUAÇÃO HIPOTÉTICA' : '',
    title: '[Título da ideia]',
    body: '[Explicação completa e condição de aplicação]',
    proof: '[Prova autêntica ou trecho conferível]',
    source: '[Fonte, versão e trecho]',
    action: '[Ação e destino confirmados]',
    condition: '[Condição, limite ou critério]',
    statement: '[Afirmação a conferir]',
    correction: '[Correção com fonte]',
    question: '[Dúvida real a responder]',
    answer: '[Resposta verificada]',
    leftTitle: '[Condição A]',
    leftBody: placeholder,
    rightTitle: '[Condição B]',
    rightBody: placeholder,
    step1: '[Etapa conferível 1]',
    step2: '[Etapa conferível 2]',
    step3: '[Etapa conferível 3]',
    step4: '[Etapa conferível 4]',
    row1Label: '[Critério 1]',
    row1Left: placeholder,
    row1Right: placeholder,
    row2Label: '[Critério 2]',
    row2Left: placeholder,
    row2Right: placeholder,
    row3Label: '[Critério 3]',
    row3Left: placeholder,
    row3Right: placeholder,
  }
}

const fields: Array<{ name: keyof SpecElements; label: string; multiline?: boolean }> = [
  { name: 'eyebrow', label: 'Contexto' },
  { name: 'title', label: 'Título' },
  { name: 'body', label: 'Explicação', multiline: true },
  { name: 'condition', label: 'Condição ou limite', multiline: true },
  { name: 'proof', label: 'Texto da prova', multiline: true },
  { name: 'source', label: 'Fonte da prova', multiline: true },
  { name: 'question', label: 'Pergunta' },
  { name: 'answer', label: 'Resposta' },
  { name: 'statement', label: 'Afirmação em análise', multiline: true },
  { name: 'correction', label: 'Correção', multiline: true },
  { name: 'leftTitle', label: 'Lado A' },
  { name: 'leftBody', label: 'Explicação A', multiline: true },
  { name: 'rightTitle', label: 'Lado B' },
  { name: 'rightBody', label: 'Explicação B', multiline: true },
  { name: 'step1', label: 'Etapa 1', multiline: true },
  { name: 'step2', label: 'Etapa 2', multiline: true },
  { name: 'step3', label: 'Etapa 3', multiline: true },
  { name: 'step4', label: 'Etapa 4', multiline: true },
  { name: 'row1Label', label: 'Critério 1' },
  { name: 'row1Left', label: 'Critério 1, lado A' },
  { name: 'row1Right', label: 'Critério 1, lado B' },
  { name: 'row2Label', label: 'Critério 2' },
  { name: 'row2Left', label: 'Critério 2, lado A' },
  { name: 'row2Right', label: 'Critério 2, lado B' },
  { name: 'row3Label', label: 'Critério 3' },
  { name: 'row3Left', label: 'Critério 3, lado A' },
  { name: 'row3Right', label: 'Critério 3, lado B' },
  { name: 'action', label: 'Ação e destino', multiline: true },
]

function SpecControls({ elements, setElementField }: TemplateControlsProps<SpecElements>) {
  const updateField = (path: (string | number)[], value: unknown) => setElementField?.(path, value)
  return (
    <>
      <ControlSection title="Conteúdo e evidência">
        {fields.map(({ name, label, multiline }) => (
          <ControlRow key={name} label={label}>
            {multiline ? (
              <textarea
                value={String(elements[name] ?? '')}
                onChange={(event) => updateField([name], event.target.value)}
                className="min-h-20 w-full resize-y rounded-none border border-ui-border bg-ui-surface px-3 py-2 text-sm text-ui-primary"
              />
            ) : (
              <Input
                value={String(elements[name] ?? '')}
                onChange={(event) => updateField([name], event.target.value)}
                className="rounded-none text-sm"
              />
            )}
          </ControlRow>
        ))}
        <ControlRow label="Imagem de prova autêntica">
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) updateField(['proofImage'], URL.createObjectURL(file))
              event.target.value = ''
            }}
            className="rounded-none text-sm"
          />
        </ControlRow>
      </ControlSection>
    </>
  )
}

const commonFields: FieldDef[] = [
  { name: 'eyebrow', semantic: 'context', type: 'text', required: false, maxLength: 180, bindable: true },
  { name: 'title', semantic: 'title', type: 'text', required: true, maxLength: 180, bindable: true },
  { name: 'body', semantic: 'body', type: 'text', required: false, maxLength: 1000, bindable: true },
  { name: 'condition', semantic: 'qualification', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'proof', semantic: 'evidence', type: 'text', required: false, maxLength: 1000, bindable: true },
  { name: 'source', semantic: 'source', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'proofImage', semantic: 'evidence', type: 'image', required: false, bindable: true },
  { name: 'action', semantic: 'cta', type: 'text', required: false, maxLength: 300, bindable: true },
  { name: 'question', semantic: 'question', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'answer', semantic: 'answer', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'statement', semantic: 'claim', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'correction', semantic: 'correction', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'leftTitle', semantic: 'comparison-label', type: 'text', required: false, maxLength: 120, bindable: true },
  { name: 'leftBody', semantic: 'comparison-value', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'rightTitle', semantic: 'comparison-label', type: 'text', required: false, maxLength: 120, bindable: true },
  { name: 'rightBody', semantic: 'comparison-value', type: 'text', required: false, maxLength: 500, bindable: true },
  { name: 'step1', semantic: 'step', type: 'text', required: false, maxLength: 300, bindable: true },
  { name: 'step2', semantic: 'step', type: 'text', required: false, maxLength: 300, bindable: true },
  { name: 'step3', semantic: 'step', type: 'text', required: false, maxLength: 300, bindable: true },
  { name: 'step4', semantic: 'step', type: 'text', required: false, maxLength: 300, bindable: true },
  ...[1, 2, 3].flatMap((row) => [
    { name: `row${row}Label`, semantic: 'comparison-criterion', type: 'text' as const, required: false, maxLength: 120, bindable: true },
    { name: `row${row}Left`, semantic: 'comparison-value', type: 'text' as const, required: false, maxLength: 300, bindable: true },
    { name: `row${row}Right`, semantic: 'comparison-value', type: 'text' as const, required: false, maxLength: 300, bindable: true },
  ]),
]

export const NEW_SPEC_TEMPLATES: TemplateDefinition<SpecElements>[] = NEW_SPEC_DEFINITIONS.map((spec) => {
  const isCarousel = spec.id.startsWith('carousel-')
  const isStory = spec.format === 'portrait'
  return {
    id: spec.id,
    name: spec.name,
    category: isCarousel ? 'Carrosséis' : isStory ? 'Stories' : 'Posts de Feed',
    filter: isCarousel ? 'carousel' : isStory ? 'portrait' : 'square',
    format: spec.format,
    tags: ['fiscal', 'policial', 'tribunal', 'motivacao'],
    defaults: createSpecDefaults(spec.id),
    Render: (props) => <SpecComposition {...props} layout={spec.id} />,
    Controls: SpecControls,
    fieldSchema: { fields: [...commonFields] },
    capabilities: { image: true, cta: true, list: true, resize: false, styles: ['title', 'body', 'evidence', 'source', 'cta'] },
    variants: [
      { id: 'short', label: 'Baixa densidade', density: 'short', itemCount: 2, hasImage: spec.id.includes('proof') || spec.id.includes('evidence') },
      { id: 'medium', label: 'Densidade média', density: 'medium', itemCount: 3, hasImage: spec.id.includes('proof') || spec.id.includes('evidence') },
      { id: 'long', label: 'Alta densidade', density: 'long', itemCount: 4, hasImage: spec.id.includes('proof') || spec.id.includes('evidence') },
    ],
  }
})

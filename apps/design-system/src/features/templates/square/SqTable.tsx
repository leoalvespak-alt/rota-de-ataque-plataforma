import type { TemplateRenderProps, TemplateControlsProps } from '../types'
import { TTitle, TRedline } from '../primitives'
import { EditableText } from '../primitives/EditableText'
import { useEditorStore } from '@/stores/useEditorStore'
import { ControlSection } from '@/features/editor/ControlPanel/ControlSection'
import { ControlToggle } from '@/features/editor/ControlPanel/ControlToggle'

export interface SqTableElements {
  title: string
  cols: string[]
  rows: string[][]
}

/**
 * Espelha renderTableSquare() do Gerador/index.html (linha 2422).
 * Corrige a auditoria items 1-2: as células usavam `data-field="th-${i}"`/`"td-${i}-${j}"`,
 * chaves soltas que nenhum lugar lia de volta — edição nunca persistia após re-render.
 * Aqui o path aponta direto para `cols.${i}` / `rows.${i}.${j}`, os campos reais do state.
 */
export function SqTableRender({ elements: el, dark }: TemplateRenderProps<SqTableElements>) {
  const cols = Array.isArray(el.cols) ? el.cols : ['SEM PLANO', 'ROTA DE ATAQUE']
  const rows = Array.isArray(el.rows)
    ? el.rows
    : [
        ['Plano aleatório', 'Plano Rota de Ataque'],
        ['Sem foco', 'Meta diária'],
        ['0 aprovações', '10k aprovados'],
      ]

  return (
    <div className="relative z-2 flex h-full flex-col gap-7 p-20">
      <TTitle fontSize={68} dark={dark}>
        <EditableText path="title" value={el.title} />
      </TTitle>
      <TRedline />
      {/* Nota de fidelidade: a tabela em si é sempre light no original (renderTableSquare,
          linhas 2427-2431) — cores das células/linhas hardcoded sem regra de dark mode. */}
      <table className="w-full flex-1 border-collapse">
        <thead>
          <tr style={{ background: 'var(--red)' }}>
            {cols.map((c, i) => (
              <th
                key={i}
                className="px-5 py-4 text-left font-heading text-[26px] font-bold tracking-[0.06em] text-white"
                style={{
                  borderRight: i < cols.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                }}
              >
                <EditableText path={`cols.${i}`} value={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              style={{ background: i % 2 === 0 ? 'var(--light-bg)' : 'var(--light-bg-alt)' }}
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className="px-5 py-4.5 text-[28px]"
                  style={{
                    color: j === cols.length - 1 ? 'var(--light-text)' : 'var(--light-muted)',
                    fontWeight: j === cols.length - 1 ? 600 : 400,
                    borderRight: j < cols.length - 1 ? '1px solid var(--light-border)' : 'none',
                  }}
                >
                  <EditableText path={`rows.${i}.${j}`} value={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Espelha buildTableControls() e tableAction() do Gerador/index.html (linhas 2676, 2695). */
export function SqTableControls({ elements: el }: TemplateControlsProps<SqTableElements>) {
  const toggleDarkMode = useEditorStore((s) => s.toggleDarkMode)
  const darkMode = useEditorStore((s) => s.darkMode)
  const setElementField = useEditorStore((s) => s.setElementField)

  const cols = Array.isArray(el.cols) ? el.cols : ['SEM PLANO', 'ROTA DE ATAQUE']
  const rows = Array.isArray(el.rows) ? el.rows : [['A', 'B']]

  const tableAction = (action: 'addCol' | 'removeCol' | 'addRow' | 'removeRow') => {
    if (action === 'addCol') {
      setElementField(['cols'], [...cols, 'NOVA COLUNA'])
      setElementField(
        ['rows'],
        rows.map((r) => [...r, 'Novo item']),
      )
    } else if (action === 'removeCol') {
      if (cols.length > 1) {
        setElementField(['cols'], cols.slice(0, -1))
        setElementField(
          ['rows'],
          rows.map((r) => r.slice(0, -1)),
        )
      }
    } else if (action === 'addRow') {
      setElementField(['rows'], [...rows, Array(cols.length).fill('Novo item')])
    } else if (action === 'removeRow') {
      if (rows.length > 1) setElementField(['rows'], rows.slice(0, -1))
    }
  }

  return (
    <>
      <ControlSection title="Tabela">
        <div className="mb-2.5 flex gap-2.5">
          <button
            className="flex-1 rounded-md border px-1.5 py-1.5 text-xs"
            style={{
              borderColor: 'var(--ui-border)',
              background: 'var(--ui-panel)',
              color: 'var(--ui-text)',
            }}
            onClick={() => tableAction('addCol')}
          >
            + Coluna
          </button>
          <button
            className="flex-1 rounded-md border px-1.5 py-1.5 text-xs"
            style={{
              borderColor: 'var(--ui-border)',
              background: 'var(--ui-panel)',
              color: 'var(--ui-text)',
            }}
            onClick={() => tableAction('removeCol')}
          >
            - Coluna
          </button>
        </div>
        <div className="flex gap-2.5">
          <button
            className="flex-1 rounded-md border px-1.5 py-1.5 text-xs"
            style={{
              borderColor: 'var(--ui-border)',
              background: 'var(--ui-panel)',
              color: 'var(--ui-text)',
            }}
            onClick={() => tableAction('addRow')}
          >
            + Linha
          </button>
          <button
            className="flex-1 rounded-md border px-1.5 py-1.5 text-xs"
            style={{
              borderColor: 'var(--ui-border)',
              background: 'var(--ui-panel)',
              color: 'var(--ui-text)',
            }}
            onClick={() => tableAction('removeRow')}
          >
            - Linha
          </button>
        </div>
      </ControlSection>
      <ControlSection title="Tema">
        <ControlToggle label="Modo Escuro" checked={darkMode} onCheckedChange={toggleDarkMode} />
      </ControlSection>
    </>
  )
}

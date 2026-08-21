/**
 * EditorialLayout — layout aninhado para a rota /teses/*.
 * Substitui o EditorialView original: a barra de sub-abas usa NavLink em vez de useState,
 * e o conteúdo é renderizado pelo <Outlet />.
 */
import { NavLink, Outlet } from 'react-router-dom'

const sections: { to: string; label: string }[] = [
  { to: '/teses', label: 'Teses' },
  { to: '/teses/conhecimento', label: 'Conhecimento' },
  { to: '/teses/planejador', label: 'Planejador' },
  { to: '/teses/lote', label: 'Lote' },
  { to: '/teses/calendario', label: 'Calendário' },
  { to: '/teses/revisao', label: 'Revisão' },
  { to: '/teses/prompts', label: 'Prompts' },
  { to: '/teses/metricas', label: 'Métricas' },
]

export function EditorialLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-ui-bg">
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-ui-border bg-ui-panel px-4 py-3"
        aria-label="Sub-abas editoriais"
      >
        {sections.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/teses'}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
                isActive
                  ? 'bg-brand-red text-white'
                  : 'text-ui-muted hover:bg-ui-panel2 hover:text-ui-text'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  )
}

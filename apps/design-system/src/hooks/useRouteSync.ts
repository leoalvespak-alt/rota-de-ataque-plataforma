/**
 * useRouteSync — mantém o useUiStore.activeTab sincronizado com a rota atual.
 *
 * - Quando a rota muda externamente (browser back/fwd, NavLink), atualiza activeTab.
 * - Quando setTab é chamado (atalhos 1-6, CommandPalette), navega para a URL correspondente.
 *
 * Monte este hook UMA VEZ em AppShell.
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUiStore, type AppTab } from '@/stores/useUiStore'

/** Mapeia segmento de URL → AppTab */
const PATH_TO_TAB: Record<string, AppTab> = {
  '': 'dashboard',
  'marca': 'brand',
  'ia': 'ai-config',
  'renders': 'renders',
  'historico': 'history',
  'criar': 'create',
  'wizard': 'wizard',
  'teses': 'editorial',
}

/** Mapeia AppTab → URL */
export const TAB_TO_PATH: Record<AppTab, string> = {
  dashboard: '/',
  brand: '/marca',
  'ai-config': '/ia',
  renders: '/renders',
  history: '/historico',
  create: '/criar',
  wizard: '/wizard',
  editorial: '/teses',
}

function pathToTab(pathname: string): AppTab {
  const first = pathname.split('/')[1] ?? ''
  return PATH_TO_TAB[first] ?? 'dashboard'
}

export function useRouteSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const setTab = useUiStore((s) => s.setTab)
  const activeTab = useUiStore((s) => s.activeTab)

  // Rota → Store: quando a URL muda, sincroniza o store
  useEffect(() => {
    const tab = pathToTab(location.pathname)
    setTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Store → Rota: quando setTab é chamado programaticamente (atalhos, palette)
  // substitui a função setTab no store para que também navegue.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    // Patch setTab: intercepta chamadas externas e navega
    const originalSetTab = useUiStore.getState().setTab
    const patchedSetTab = (tab: AppTab) => {
      originalSetTab(tab)
      const path = TAB_TO_PATH[tab]
      navigateRef.current(path, { replace: false })
    }
    useUiStore.setState({ setTab: patchedSetTab })

    return () => {
      // Restaura ao desmontar (não deve ocorrer em condições normais)
      useUiStore.setState({ setTab: originalSetTab })
    }
  // Só executa uma vez na montagem
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { activeTab }
}

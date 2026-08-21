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
  marca: 'brand',
  ia: 'ai-config',
  renders: 'renders',
  historico: 'history',
  criar: 'create',
  wizard: 'wizard',
  teses: 'editorial',
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

type NavigateFn = ReturnType<typeof useNavigate>

export function useRouteSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = useUiStore((s) => s.activeTab)

  // Manter referência estável ao navigate sem re-executar o efeito de patch
  const navigateRef = useRef<NavigateFn>(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  // Rota → Store: quando a URL muda, sincroniza o store
  useEffect(() => {
    const tab = pathToTab(location.pathname)
    useUiStore.getState().setTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Store → Rota: patch de setTab para que atalhos/CommandPalette também naveguem
  useEffect(() => {
    const originalSetTab = useUiStore.getState().setTab
    const patchedSetTab = (tab: AppTab): void => {
      originalSetTab(tab)
      const path = TAB_TO_PATH[tab]
      navigateRef.current(path, { replace: false })
    }
    useUiStore.setState({ setTab: patchedSetTab })

    return () => {
      useUiStore.setState({ setTab: originalSetTab })
    }
    // Só executa uma vez na montagem
  }, [])

  return { activeTab }
}

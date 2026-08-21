import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUiStore, type AppTab } from '@/stores/useUiStore'

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
  const navigateRef = useRef(navigate)
  const syncingFromRoute = useRef(false)

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    const tab = pathToTab(location.pathname)
    if (useUiStore.getState().activeTab !== tab) {
      syncingFromRoute.current = true
      useUiStore.getState().setTab(tab)
      syncingFromRoute.current = false
    }
  }, [location.pathname])

  useEffect(() => {
    const originalSetTab = useUiStore.getState().setTab
    const patchedSetTab = (tab: AppTab): void => {
      originalSetTab(tab)
      if (!syncingFromRoute.current) {
        const path = TAB_TO_PATH[tab]
        if (path) navigateRef.current(path, { replace: false })
      }
    }
    useUiStore.setState({ setTab: patchedSetTab })

    return () => {
      useUiStore.setState({ setTab: originalSetTab })
    }
  }, [])

  return { activeTab: useUiStore((s) => s.activeTab) }
}

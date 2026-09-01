export type NavigationTab = {
  id: string
  label_pt: string
  href: string
  legacyPath?: string
  legacyPaths?: readonly string[]
  temporal?: boolean
}

export type NavigationDestinationId = 'pulse' | 'intelligence' | 'decisions' | 'planning' | 'performance' | 'system'
export type NavigationDestination = {
  id: NavigationDestinationId
  title: string
  href: string
  icon: 'home' | 'intelligence' | 'decisions' | 'content' | 'relationship' | 'performance' | 'automations'
  tabs: readonly NavigationTab[]
}

export const NAVIGATION = [
  { id: 'pulse', title: 'Pulso', href: '/', icon: 'home', tabs: [{ id: 'pulso', label_pt: 'Pulso', href: '/' }] },
  { id: 'intelligence', title: 'Radar', href: '/radar', icon: 'intelligence', tabs: [
    { id: 'radar', label_pt: 'Radar', href: '/radar', legacyPath: '/inteligencia/radar', temporal: true },
  ] },
  { id: 'decisions', title: 'Decisões', href: '/decisoes', icon: 'decisions', tabs: [
    { id: 'revisao', label_pt: 'Revisão', href: '/decisoes/revisao', legacyPath: '/review-inbox' },
  ] },
  { id: 'planning', title: 'Planejamento', href: '/planejamento', icon: 'content', tabs: [
    { id: 'funil', label_pt: 'Funil', href: '/planejamento/funil', legacyPath: '/conteudo', temporal: true },
    { id: 'oportunidades', label_pt: 'Oportunidades', href: '/planejamento/oportunidades', legacyPath: '/content-opportunity' },
    { id: 'conteudos', label_pt: 'Conteúdos', href: '/planejamento/conteudos', legacyPath: '/content-items' },
    { id: 'teses', label_pt: 'Teses', href: '/planejamento/teses', legacyPath: '/theses' },
    { id: 'ponte', label_pt: 'Ponte criativa', href: '/planejamento/ativos', legacyPath: '/creative-bridge' },
    { id: 'aprovacao', label_pt: 'Aprovações', href: '/planejamento/aprovacoes' },
  ] },
  { id: 'performance', title: 'Performance', href: '/performance', icon: 'performance', tabs: [
    { id: 'conteudo', label_pt: 'Conteúdo', href: '/performance/conteudo', legacyPath: '/desempenho', temporal: true },
  ] },
  { id: 'system', title: 'Sistema', href: '/sistema', icon: 'automations', tabs: [
    { id: 'saude', label_pt: 'Saúde', href: '/sistema/saude', legacyPath: '/system-health' },
    { id: 'integracoes', label_pt: 'Integrações', href: '/sistema/integracoes' },
    { id: 'ia', label_pt: 'IA', href: '/ai-settings' },
    { id: 'runbooks', label_pt: 'Runbooks', href: '/sistema/avancado/runbooks', legacyPath: '/docs/runbooks' },
  ] },
] as const satisfies readonly NavigationDestination[]

export function navigationHref(destination: Pick<NavigationDestination, 'href'>, tab?: Pick<NavigationTab, 'href'>) {
  return tab?.href ?? destination.href
}

export const LEGACY_REDIRECTS = Object.fromEntries(
  NAVIGATION.flatMap((destination) => destination.tabs.flatMap((tab) => {
    const paths = [
      ...(('legacyPath' in tab && tab.legacyPath) ? [tab.legacyPath] : []),
      ...(('legacyPaths' in tab && Array.isArray(tab.legacyPaths)) ? tab.legacyPaths : []),
    ]
    return paths.map((legacyPath) => [legacyPath, destination.href + '?aba=' + tab.id] as const)
  })),
) as Record<string, string>

export function isTemporalDestination(pathname: string, tabId: string | null) {
  const destination = NAVIGATION.find((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/')))
  if (!destination) return false
  const tab = destination.tabs.find((item) => item.id === tabId) ?? destination.tabs.find((item) => pathname === item.href)
  return Boolean(tab && 'temporal' in tab && tab.temporal)
}

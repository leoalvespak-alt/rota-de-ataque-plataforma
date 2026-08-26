export type NavigationTab = {
  id: string
  label_pt: string
  href: string
  legacyPath?: string
  legacyPaths?: readonly string[]
  temporal?: boolean
}

export type NavigationDestinationId = 'pulse' | 'intelligence' | 'decisions' | 'planning' | 'audience' | 'performance' | 'system'

export type NavigationDestination = {
  id: NavigationDestinationId
  title: string
  href: string
  icon: 'home' | 'intelligence' | 'decisions' | 'content' | 'relationship' | 'performance' | 'automations'
  tabs: readonly NavigationTab[]
}

/** Mapa canônico da experiência única do Prospector. Recursos técnicos são
 * progressivos por rota/permissão, nunca por um modo global. */
export const NAVIGATION = [
  { id: 'pulse', title: 'Pulso', href: '/', icon: 'home', tabs: [{ id: 'pulso', label_pt: 'Pulso', href: '/' }] },
  { id: 'intelligence', title: 'Inteligência', href: '/inteligencia', icon: 'intelligence', tabs: [
    { id: 'radar', label_pt: 'Radar', href: '/inteligencia/radar', legacyPath: '/radar', temporal: true },
    { id: 'mercado', label_pt: 'Mercado', href: '/inteligencia/mercado', legacyPath: '/market-radar', temporal: true },
    { id: 'concorrentes', label_pt: 'Concorrentes', href: '/inteligencia/concorrentes', legacyPath: '/competitive-intel', temporal: true },
    { id: 'comunidades', label_pt: 'Comunidades', href: '/inteligencia/comunidades', legacyPath: '/community', temporal: true },
  ] },
  { id: 'decisions', title: 'Decisões', href: '/decisoes', icon: 'decisions', tabs: [
    { id: 'revisao', label_pt: 'Revisão', href: '/decisoes/revisao', legacyPath: '/review-inbox' },
    { id: 'radar', label_pt: 'Radar', href: '/decisoes?view=radar' },
    { id: 'insights', label_pt: 'Insights', href: '/decisoes?view=insights' },
    { id: 'sugestoes', label_pt: 'Sugestões', href: '/decisoes?view=sugestoes' },
    { id: 'engajamento', label_pt: 'Engajamento', href: '/decisoes/engajamento', legacyPath: '/engagement-queue' },
  ] },
  { id: 'planning', title: 'Planejamento', href: '/planejamento', icon: 'content', tabs: [
    { id: 'funil', label_pt: 'Funil', href: '/planejamento/funil', legacyPath: '/conteudo', temporal: true },
    { id: 'oportunidades', label_pt: 'Oportunidades', href: '/planejamento/oportunidades', legacyPath: '/content-opportunity' },
    { id: 'conteudos', label_pt: 'Conteúdos', href: '/planejamento/conteudos', legacyPath: '/content-items' },
    { id: 'teses', label_pt: 'Teses', href: '/planejamento/teses', legacyPath: '/theses' },
    { id: 'ponte', label_pt: 'Ponte criativa', href: '/planejamento/ativos', legacyPath: '/creative-bridge' },
    { id: 'calendario', label_pt: 'Calendário', href: '/planejamento/calendario', legacyPath: '/publishing', temporal: true },
    { id: 'aprovacao', label_pt: 'Aprovações', href: '/planejamento/aprovacoes' },
    { id: 'comprovantes', label_pt: 'Comprovantes', href: '/planejamento/comprovantes' },
  ] },
  { id: 'audience', title: 'Público', href: '/publico', icon: 'relationship', tabs: [
    { id: 'leads', label_pt: 'Pessoas', href: '/publico/pessoas', legacyPath: '/leads' },
    { id: 'segmentos', label_pt: 'Segmentos', href: '/publico/segmentos' },
    { id: 'conversas', label_pt: 'Conversas', href: '/publico/conversas', legacyPaths: ['/conversations', '/relacionamento'] },
    { id: 'timeline', label_pt: 'Timeline', href: '/publico/timeline', legacyPath: '/timeline', temporal: true },
    { id: 'identidades', label_pt: 'Identidades', href: '/publico/identidades', legacyPath: '/identities' },
    { id: 'canais', label_pt: 'Canais', href: '/publico/canais', legacyPath: '/communities' },
    { id: 'politicas', label_pt: 'Políticas', href: '/publico/politicas', legacyPath: '/contact-policies' },
    { id: 'email', label_pt: 'E-mail', href: '/publico/email', legacyPath: '/email-flows' },
  ] },
  { id: 'performance', title: 'Performance', href: '/performance', icon: 'performance', tabs: [
    { id: 'roi', label_pt: 'Atribuição', href: '/performance/roi', legacyPath: '/source-roi', temporal: true },
    { id: 'orcamento', label_pt: 'Orçamento', href: '/performance/orcamento', legacyPath: '/organic-budgets', temporal: true },
    { id: 'conteudo', label_pt: 'Conteúdo', href: '/performance/conteudo', legacyPath: '/desempenho', temporal: true },
  ] },
  { id: 'system', title: 'Sistema', href: '/sistema', icon: 'automations', tabs: [
    { id: 'motores', label_pt: 'Motores', href: '/sistema/motores', legacyPath: '/automations' },
    { id: 'contas', label_pt: 'Integrações', href: '/sistema/integracoes', legacyPaths: ['/accounts', '/configuracoes'] },
    { id: 'saude', label_pt: 'Saúde', href: '/sistema/saude', legacyPath: '/system-health' },
    { id: 'notificacoes', label_pt: 'Incidentes', href: '/sistema/incidentes', legacyPath: '/notifications' },
    { id: 'ia', label_pt: 'IA', href: '/sistema/avancado/ia', legacyPath: '/ai-settings' },
    { id: 'scoring', label_pt: 'Scoring', href: '/sistema/avancado/scoring', legacyPath: '/configs' },
    { id: 'runbooks', label_pt: 'Runbooks', href: '/sistema/avancado/runbooks', legacyPath: '/docs/runbooks' },
    { id: 'filas', label_pt: 'Filas', href: '/sistema/avancado/filas' },
    { id: 'agendamentos', label_pt: 'Agendamentos', href: '/sistema/avancado/agendamentos' },
    { id: 'workers', label_pt: 'Workers', href: '/sistema/avancado/workers' },
  ] },
] as const satisfies readonly NavigationDestination[]

export function navigationHref(destination: Pick<NavigationDestination, 'href'>, tab?: Pick<NavigationTab, 'href'>) {
  return tab?.href ?? destination.href
}

export const LEGACY_REDIRECTS = Object.fromEntries(
  NAVIGATION.flatMap((destination) => destination.tabs
    .flatMap((tab) => {
      const paths = [
        ...(('legacyPath' in tab && tab.legacyPath) ? [tab.legacyPath] : []),
        ...(('legacyPaths' in tab && tab.legacyPaths) ? tab.legacyPaths : []),
      ]
      return paths.map((legacyPath) => [legacyPath, `${destination.href}?aba=${tab.id}`] as const)
    })),
) as Record<string, string>

export function isTemporalDestination(pathname: string, tabId: string | null) {
  const destination = NAVIGATION.find((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)))
  if (!destination) return false
  const tab = destination.tabs.find((item) => item.id === tabId) ?? destination.tabs.find((item) => pathname === item.href)
  return Boolean(tab && 'temporal' in tab && tab.temporal)
}

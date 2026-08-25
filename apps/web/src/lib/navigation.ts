export type NavigationTier = 'simple' | 'advanced'

export type NavigationTab = {
  id: string
  label_pt: string
  legacyPath?: string
  tier: NavigationTier
  temporal?: boolean
}

export type NavigationDestination = {
  id: string
  title: string
  href: string
  icon: 'home' | 'intelligence' | 'decisions' | 'content' | 'relationship' | 'performance' | 'automations'
  tier: NavigationTier
  tabs: readonly NavigationTab[]
}

/** Os sete destinos principais. Recursos técnicos permanecem nas abas avançadas. */
export const NAVIGATION = [
  { id: 'today', title: 'Hoje', href: '/', icon: 'home', tier: 'simple', tabs: [{ id: 'hoje', label_pt: 'Hoje', tier: 'simple', temporal: true }] },
  { id: 'discoveries', title: 'Descobertas', href: '/inteligencia', icon: 'intelligence', tier: 'simple', tabs: [
    { id: 'radar', label_pt: 'Radar', legacyPath: '/radar', tier: 'simple', temporal: true },
    { id: 'mercado', label_pt: 'Mercado', legacyPath: '/market-radar', tier: 'simple', temporal: true },
    { id: 'concorrentes', label_pt: 'Concorrentes', legacyPath: '/competitive-intel', tier: 'simple', temporal: true },
    { id: 'comunidades', label_pt: 'Comunidades', legacyPath: '/community', tier: 'simple', temporal: true },
  ] },
  { id: 'decisions', title: 'Decisões', href: '/decisoes', icon: 'decisions', tier: 'simple', tabs: [
    { id: 'revisao', label_pt: 'Revisão', legacyPath: '/review-inbox', tier: 'simple' },
    { id: 'radar', label_pt: 'Achados do radar', tier: 'simple' },
    { id: 'insights', label_pt: 'Insights', tier: 'simple' },
    { id: 'sugestoes', label_pt: 'Sugestões', tier: 'simple' },
    { id: 'engajamento', label_pt: 'Engajamento', legacyPath: '/engagement-queue', tier: 'simple' },
  ] },
  { id: 'content', title: 'Conteúdo', href: '/conteudo', icon: 'content', tier: 'simple', tabs: [
    { id: 'funil', label_pt: 'Funil', tier: 'simple' },
    { id: 'oportunidades', label_pt: 'Oportunidades', legacyPath: '/content-opportunity', tier: 'simple' },
    { id: 'conteudos', label_pt: 'Conteúdos', legacyPath: '/content-items', tier: 'simple' },
    { id: 'teses', label_pt: 'Teses', legacyPath: '/theses', tier: 'simple' },
    { id: 'ponte', label_pt: 'Ponte criativa', legacyPath: '/creative-bridge', tier: 'advanced' },
    { id: 'calendario', label_pt: 'Calendário', legacyPath: '/publishing', tier: 'simple', temporal: true },
    { id: 'aprovacao', label_pt: 'Aprovação', tier: 'simple' },
    { id: 'comprovantes', label_pt: 'Comprovantes', tier: 'simple' },
  ] },
  { id: 'relationship', title: 'Relacionamento', href: '/relacionamento', icon: 'relationship', tier: 'simple', tabs: [
    { id: 'leads', label_pt: 'Pessoas', legacyPath: '/leads', tier: 'simple' },
    { id: 'timeline', label_pt: 'Timeline', legacyPath: '/timeline', tier: 'simple', temporal: true },
    { id: 'identidades', label_pt: 'Identidades', legacyPath: '/identities', tier: 'advanced' },
    { id: 'conversas', label_pt: 'Conversas', legacyPath: '/conversations', tier: 'simple' },
    { id: 'email', label_pt: 'E-mail', legacyPath: '/email-flows', tier: 'simple' },
    { id: 'politicas', label_pt: 'Políticas', legacyPath: '/contact-policies', tier: 'simple' },
    { id: 'grupos', label_pt: 'Grupos', legacyPath: '/communities', tier: 'simple' },
  ] },
  { id: 'results', title: 'Resultados', href: '/desempenho', icon: 'performance', tier: 'simple', tabs: [
    { id: 'roi', label_pt: 'ROI', legacyPath: '/source-roi', tier: 'simple', temporal: true },
    { id: 'orcamento', label_pt: 'Orçamento', legacyPath: '/organic-budgets', tier: 'simple', temporal: true },
    { id: 'conteudo', label_pt: 'Conteúdo', tier: 'simple', temporal: true },
  ] },
  { id: 'operation', title: 'Operação', href: '/automacoes', icon: 'automations', tier: 'simple', tabs: [
    { id: 'motores', label_pt: 'Motores', legacyPath: '/automations', tier: 'simple' },
    { id: 'contas', label_pt: 'Contas', legacyPath: '/accounts', tier: 'simple' },
    { id: 'saude', label_pt: 'Saúde', legacyPath: '/system-health', tier: 'simple' },
    { id: 'notificacoes', label_pt: 'Incidentes', legacyPath: '/notifications', tier: 'simple' },
    { id: 'workers', label_pt: 'Workers', tier: 'advanced' },
    { id: 'filas', label_pt: 'Filas', tier: 'advanced' },
    { id: 'agendamentos', label_pt: 'Agendamentos', tier: 'advanced' },
    { id: 'ia', label_pt: 'IA', legacyPath: '/ai-settings', tier: 'advanced' },
    { id: 'scoring', label_pt: 'Scoring', legacyPath: '/configs', tier: 'advanced' },
    { id: 'runbooks', label_pt: 'Runbooks', legacyPath: '/docs/runbooks', tier: 'advanced' },
  ] },
] as const satisfies readonly NavigationDestination[]

export function navigationHref(destination: Pick<NavigationDestination, 'href'>, tab?: Pick<NavigationTab, 'id'>) {
  return tab && destination.href !== '/' ? `${destination.href}?aba=${tab.id}` : destination.href
}

export const LEGACY_REDIRECTS = Object.fromEntries(
  NAVIGATION.flatMap((destination) => destination.tabs
    .filter((tab) => 'legacyPath' in tab && tab.legacyPath)
    .map((tab) => [('legacyPath' in tab ? tab.legacyPath : ''), navigationHref(destination, tab)])),
) as Record<string, string>

export function isTemporalDestination(pathname: string, tabId: string | null) {
  const destination = NAVIGATION.find((item) => item.href === pathname)
  if (!destination) return false
  const tab = destination.tabs.find((item) => item.id === (tabId ?? destination.tabs[0]?.id))
  return Boolean(tab && 'temporal' in tab && tab.temporal)
}

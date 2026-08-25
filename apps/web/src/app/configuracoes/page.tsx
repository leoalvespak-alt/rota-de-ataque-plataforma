import { RouteTabs } from '@/components/RouteTabs'
import AccountsView from '../accounts/view'
import AiSettingsView from '../ai-settings/view'
import ConfigsView from '../configs/view'
import NotificationsView from '../notifications/view'
import SystemHealthView from '../system-health/view'
import RunbooksView from '../docs/runbooks/view'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = typeof (await searchParams).aba === 'string' ? (await searchParams).aba as string : 'contas'
  const props = { searchParams: searchParams as never }
  const content = tab === 'ia' ? <AiSettingsView />
    : tab === 'scoring' ? <ConfigsView />
      : tab === 'notificacoes' ? <NotificationsView />
        : tab === 'saude' ? <SystemHealthView />
          : tab === 'runbooks' ? <RunbooksView />
            : <AccountsView {...props} />
  return <RouteTabs destinationId="operation" activeTab={tab}>{content}</RouteTabs>
}

import { EmptyState, PageHeader } from '@plataforma/ui-bridge'
import { CommunitiesAvailability } from './CommunitiesAvailability'

export default function CommunitiesPage() {
  return <main className="page">
    <PageHeader title="Grupos de WhatsApp" subtitle="Espaço reservado para a operação de comunidades quando a Meta liberar a Groups API." />
    <EmptyState
      message="Grupos de WhatsApp aguardando liberação da Groups API para esta conta Meta. Consulte docs/compliance/whatsapp-groups-availability.md."
      action={<CommunitiesAvailability />}
    />
  </main>
}

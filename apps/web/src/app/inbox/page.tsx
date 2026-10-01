import { SocialInboxClient } from '@/components/SocialInboxClient'
import { requireRole } from '@/lib/permissions'

export default async function InboxPage() {
  try {
    await requireRole('operator')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 403) {
      return <main className="social-inbox-page" id="main-content" aria-labelledby="social-inbox-title">
        <header className="social-inbox-header">
          <div>
            <p className="module-eyebrow">Canais recebidos</p>
            <h1 id="social-inbox-title">Inbox social</h1>
            <p>Comentários e mensagens da conta do Instagram em uma fila com histórico e prazo de resposta.</p>
          </div>
        </header>
        <section className="social-inbox-notice" role="status">
          <strong>A Inbox exige perfil de operador.</strong>
          <span>Sua conta não tem permissão para consultar eventos. Peça a uma pessoa administradora para revisar o acesso.</span>
        </section>
      </main>
    }
    throw error
  }

  return <SocialInboxClient />
}

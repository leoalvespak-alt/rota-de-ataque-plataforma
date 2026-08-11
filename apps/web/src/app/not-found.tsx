import Link from 'next/link'
import { EmptyState } from '@plataforma/ui-bridge'

export default function NotFound() {
  return <div className="page"><EmptyState message="Nada aqui ainda — volte ao Overview" action={<Link href="/">Ir ao Overview</Link>} /></div>
}

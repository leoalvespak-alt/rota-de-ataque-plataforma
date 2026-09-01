import { RunbooksClient } from './RunbooksClient'

export default function RunbooksIndexPage() {
  return <RunbooksClient runbooks={[{ slug: 'system-health', title: 'Saúde do sistema', tags: ['Infra'], status: 'active' }, { slug: 'editorial-core', title: 'Núcleo editorial', tags: ['Radar', 'Conteúdo'], status: 'active' }, { slug: 'web', title: 'Interface web', tags: ['Web'], status: 'active' }]} />
}

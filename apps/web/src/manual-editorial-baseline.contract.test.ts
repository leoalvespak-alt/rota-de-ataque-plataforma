import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname)
const source = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

describe('notification shell contract', () => {
  it('uses the authenticated application role and does not poll the admin endpoint for other roles', () => {
    const layout = source('app/layout.tsx')
    const shell = source('components/AppShell.tsx')
    const route = source('app/api/admin/notifications/count/route.ts')

    expect(layout).toMatch(/getServerSession\(authOptions\)/u)
    expect(layout).not.toMatch(/role:\s*['"]actor['"]/u)
    expect(shell).toMatch(/session\.role !== ['"]admin['"]/u)
    expect(shell).toMatch(/session\.role === ['"]admin['"] &&/u)
    expect(route).toMatch(/apiErrorResponse\(error\)/u)
  })
})

describe('manual publication editor contract', () => {
  it('uses a base-path-aware endpoint and includes standalone campaign publications', () => {
    const client = source('app/publishing/PublishingClient.tsx')
    const page = source('app/publishing/view.tsx')
    const route = source('app/api/admin/publications/route.ts')

    expect(client).toMatch(/appPath\(['"]\/api\/admin\/publications['"]\)/u)
    expect(page).toMatch(/COALESCE\(scheduled\.title,item\.hook,opportunity\.thesis\)/u)
    expect(page).toMatch(/COALESCE\(scheduled\.campaign_id,opportunity\.campaign_id\)=\$1/u)
    expect(route).toMatch(/requireRole\(['"]operator['"]\)/u)
    expect(route).toMatch(/SET LOCAL app\.actor_type = 'human'/u)
  })

  it('opens Rota de Ataque as the initial campaign while preserving explicit selection', () => {
    const context = source('lib/campaign-context.ts')

    expect(context).toMatch(/ORDER BY \(name = 'Rota de Ataque'\) DESC, name/u)
    expect(context).toMatch(/campaigns\.find[\s\S]*campaigns\[0\]/u)
  })
})

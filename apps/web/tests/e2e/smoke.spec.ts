import { test, expect } from '@playwright/test'

const routes = [
  '/', '/radar', '/decisoes', '/decisoes/revisao',
  '/planejamento', '/planejamento/funil', '/planejamento/oportunidades',
  '/planejamento/conteudos', '/planejamento/teses', '/planejamento/ativos',
  '/planejamento/aprovacoes', '/creative-bridge', '/performance',
  '/performance/conteudo', '/sistema', '/sistema/saude',
  '/sistema/integracoes', '/sistema/avancado/runbooks',
]

for (const route of routes) {
  test(`${route} loads without application errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    const res = await page.goto(route)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('body')).not.toContainText('Application error')
    expect(errors.filter(e => !e.includes('hydration'))).toHaveLength(0)
  })
}

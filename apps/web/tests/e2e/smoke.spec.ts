import { test, expect } from '@playwright/test'

const routes = [
  '/', '/leads', '/accounts', '/conversations', '/engagement-queue',
  '/theses', '/content-opportunity',
  '/content-items', '/creative-bridge', '/community', '/communities',
  '/contact-policies', '/notifications', '/configs', 
  '/competitive-intel', '/market-radar', '/timeline', '/radar',
  '/system-health', '/source-roi', '/ai-settings'
]

for (const route of routes) {
  test(`${route} loads without errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    const res = await page.goto(route)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('body')).not.toContainText('Application error')
    expect(errors.filter(e => !e.includes('hydration'))).toHaveLength(0)
  })
}
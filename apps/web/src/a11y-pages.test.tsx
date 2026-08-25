// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { LeadsClient } from './app/leads/LeadsClient'
import { ReviewInboxClient } from './app/review-inbox/ReviewInboxClient'
import { AccountsClient } from './app/accounts/AccountsClient'
import { SystemHealthClient } from './app/system-health/SystemHealthClient'
import { EngagementClient } from './app/engagement-queue/EngagementClient'
import { NotificationsClient } from './app/notifications/NotificationsClient'
import { AutomationsTabs } from './app/automations/AutomationsTabs'
import { AISettingsClient } from './app/ai-settings/AISettingsClient'
import { PublishingClient } from './app/publishing/PublishingClient'
import { TooltipProvider } from '@plataforma/ui-bridge'

vi.mock('next/navigation',()=>({useRouter:()=>({replace:vi.fn(),push:vi.fn(),refresh:vi.fn()}),usePathname:()=>'/leads',useSearchParams:()=>new URLSearchParams()}))

const pages = [
  createElement(LeadsClient, { initialRows: [] }),
  createElement(ReviewInboxClient, { initialItems: [], decidedToday: 0 }),
  createElement(AccountsClient, { accounts: [], competitors: [], campaigns: [], capabilities: [] }),
createElement(SystemHealthClient, { heartbeats: [], alerts: [], healthScore: 100, canaries: [], capabilities: [], killSwitchEnabled: false, workers: [] }),
  createElement(EngagementClient, { actions: [], policies: [] }),
  createElement(NotificationsClient, { triggers: [], alerts: [], deliveries: [] }),
  createElement(AutomationsTabs, { workers: [] }),
  createElement(AISettingsClient, { initialProviders: [], initialModels: [] }),
  createElement(PublishingClient, { publications: [], scheduled: 0, published: 0, failed: 0 }),
]

describe('critical pages accessibility', () => {
  it('has no serious axe violations on all critical pages', async () => {
    const dom = new JSDOM('<!doctype html><html lang="pt-BR"><head><title>Plataforma</title></head><body></body></html>')
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement })
    const axe = (await import('axe-core')).default
    for (const [at, page] of pages.entries()) {
      dom.window.document.body.innerHTML = `<main>${renderToStaticMarkup(createElement(TooltipProvider, null, page))}</main>`
      const result = await axe.run(dom.window.document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: false } } })
      expect(result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')), `page ${at + 1}`).toEqual([])
    }
    dom.window.close()
  }, 30_000)
})

import { chromium, type BrowserContext, type Page } from 'playwright'
import { ReasonCodeSchema, toErrorEvent, type ReasonCode } from '@plataforma/shared'

export const launchPersistentContext = (userDataDir: string, options: { headless?: boolean; slowMo?: number } = {}): Promise<BrowserContext> => chromium.launchPersistentContext(userDataDir, { headless: options.headless ?? true, slowMo: options.slowMo ?? 0, viewport: { width: 1365, height: 900 } })
interface RedisLockClient { set(key: string, value: string, mode: 'PX', ttl: number, condition: 'NX'): Promise<unknown>; eval(script: string, keys: number, ...args: string[]): Promise<unknown> }
export async function withAccountMutex<T>(redis: RedisLockClient, accountId: string, operation: () => Promise<T>) { const key = `account:${accountId}:lock`; const token = crypto.randomUUID(); const acquired = await redis.set(key, token, 'PX', 30_000, 'NX'); if (!acquired) throw Object.assign(new Error('Account lock unavailable'), { reasonCode: 'PREFLIGHT_FAILED' }); const heartbeat = setInterval(() => void redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],30000) end return 0", 1, key, token), 10_000); try { return await operation() } finally { clearInterval(heartbeat); await redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end return 0", 1, key, token) } }
export function humanDelay(minMs = 2_000, maxMs = 8_000) { return minMs + Math.floor(Math.random() * (maxMs - minMs + 1)) }
export function circuitState(input: { checkpoint: boolean; loggedOut: boolean; successRate: number; checkpointsCount: number }) { return input.checkpoint || input.loggedOut ? 'CHECKPOINT' : input.checkpointsCount > 0 || input.successRate < .9 ? 'COOLDOWN' : 'HEALTHY' }
export async function withReasonCode<T>(operation: () => Promise<T>, record: (reason: ReasonCode, error?: unknown) => Promise<void>) { try { const result = await operation(); await record('ALREADY_DONE'); return result } catch (error) { const code = ReasonCodeSchema.catch('UNKNOWN').parse((error as { reasonCode?: string }).reasonCode); await record(code, error); throw error } }
export async function withApiReasonCode<T>(operation: () => Promise<T>, context: { worker: string; traceId: string }, emit: (event: ReturnType<typeof toErrorEvent>) => Promise<void>) { try { return await operation() } catch (error) { await emit(toErrorEvent(error, { source: 'meta-api', worker: context.worker, trace_id: context.traceId, severity: 'error' })); throw error } }

export interface ExtractedComment { externalId: string; username: string; text: string; commentedAt?: string; profileSnippet: { avatar?: string; verified?: boolean } }

export class HumanRateController {
  constructor(private readonly minMs = 2_000, private readonly maxMs = 8_000) {}
  async wait() { await new Promise((resolve) => setTimeout(resolve, humanDelay(this.minMs, this.maxMs))) }
}

export async function collectInstagramComments(page: Page, postUrl: string, rate = new HumanRateController(), maxIterations = 200): Promise<ExtractedComment[]> {
  await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const expanders = page.getByRole('button', { name: /ver mais coment|carregar mais coment|view more comment|load more comment|ver respostas|view repl/i })
    const count = await expanders.count()
    let clicked = false
    for (let index = 0; index < count; index += 1) {
      const button = expanders.nth(index)
      if (!await button.isVisible().catch(() => false)) continue
      await rate.wait()
      await button.click({ timeout: 10_000 }).catch(() => undefined)
      clicked = true
    }
    if (!clicked) break
  }
  const rows = await page.locator('article ul li, main ul li').evaluateAll((items) => items.map((item, index) => {
    const anchor = item.querySelector<HTMLAnchorElement>('a[href^="/"]')
    const username = anchor?.getAttribute('href')?.split('/').filter(Boolean)[0] ?? anchor?.textContent?.trim() ?? ''
    const text = Array.from(item.querySelectorAll('span')).map((span) => span.textContent?.trim()).filter(Boolean).sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ?? ''
    const time = item.querySelector('time')?.getAttribute('datetime') ?? undefined
    const avatar = item.querySelector<HTMLImageElement>('img')?.src
    const verified = Boolean(item.querySelector('[aria-label*="Verific" i], [title*="Verific" i]'))
    const externalId = item.getAttribute('data-comment-id') ?? item.id ?? `${username}:${time ?? index}:${text.slice(0, 40)}`
    return { externalId, username, text, commentedAt: time, profileSnippet: { avatar, verified } }
  }))
  const unique = new Map(rows.filter((row) => row.username && row.text).map((row) => [row.externalId, row]))
  return [...unique.values()]
}

export async function followInstagramProfile(page: Page, profileUrl: string, rate = new HumanRateController()): Promise<{ changed: boolean }> {
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  if (/challenge|checkpoint|accounts\/login/i.test(page.url())) throw Object.assign(new Error('Instagram authentication checkpoint'), { reasonCode: 'CHECKPOINT' })
  const already = page.getByRole('button', { name: /seguindo|solicitado|following|requested/i }).first()
  if (await already.isVisible().catch(() => false)) return { changed: false }
  const follow = page.getByRole('button', { name: /^(seguir|follow)$/i }).first()
  if (!await follow.isVisible().catch(() => false)) throw Object.assign(new Error('Follow action unavailable'), { reasonCode: 'PROFILE_UNAVAILABLE' })
  await rate.wait()
  await follow.click({ timeout: 10_000 })
  await page.getByRole('button', { name: /seguindo|solicitado|following|requested/i }).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined)
  return { changed: true }
}

export interface DiscoveredProfile { username: string; permalink: string; snippet: string }
export async function searchInstagramProfiles(page: Page, term: string, rate = new HumanRateController()): Promise<DiscoveredProfile[]> {
  await page.goto(`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(term)}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await rate.wait()
  const profiles = await page.locator('a[href^="/"]').evaluateAll((anchors) => anchors.map((anchor) => { const href = anchor.getAttribute('href') ?? ''; const username = href.split('/').filter(Boolean)[0] ?? ''; return { username, permalink: new URL(href, 'https://www.instagram.com').href, snippet: anchor.textContent?.trim() ?? '' } }).filter((item) => /^[A-Za-z0-9._]{1,30}$/.test(item.username)))
  return [...new Map(profiles.map((item) => [item.username.toLowerCase(), item])).values()]
}

export async function collectVisibleFollowers(page: Page, profileUrl: string, rate = new HumanRateController(), maxScrolls = 50): Promise<DiscoveredProfile[]> {
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  const followers = page.getByRole('link', { name: /seguidores|followers/i }).first()
  if (!await followers.isVisible().catch(() => false)) throw Object.assign(new Error('Followers list unavailable'), { reasonCode: 'PROFILE_UNAVAILABLE' })
  await rate.wait(); await followers.click()
  const dialog = page.getByRole('dialog')
  for (let index = 0; index < maxScrolls; index++) { const before = await dialog.locator('a[href^="/"]').count(); await dialog.evaluate((node) => node.scrollTo(0, node.scrollHeight)); await rate.wait(); const after = await dialog.locator('a[href^="/"]').count(); if (after === before) break }
  const profiles = await dialog.locator('a[href^="/"]').evaluateAll((anchors) => anchors.map((anchor) => { const href = anchor.getAttribute('href') ?? ''; const username = href.split('/').filter(Boolean)[0] ?? ''; return { username, permalink: new URL(href, 'https://www.instagram.com').href, snippet: anchor.textContent?.trim() ?? '' } }).filter((item) => /^[A-Za-z0-9._]{1,30}$/.test(item.username)))
  return [...new Map(profiles.map((item) => [item.username.toLowerCase(), item])).values()]
}

export async function collectInstagramLive(page: Page, profileUrl: string, rate = new HumanRateController()): Promise<{ broadcastId: string; interactions: ExtractedComment[] } | null> {
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  const live = page.getByText(/ao vivo|live/i).first()
  if (!await live.isVisible().catch(() => false)) return null
  await rate.wait(); await live.click()
  const broadcastId = page.url().split('/').filter(Boolean).at(-1) ?? crypto.randomUUID()
  await rate.wait()
  const interactions = await page.locator('main li, [role="dialog"] li').evaluateAll((items) => items.map((item, index) => { const anchor = item.querySelector<HTMLAnchorElement>('a[href^="/"]'); const username = anchor?.getAttribute('href')?.split('/').filter(Boolean)[0] ?? ''; const text = item.textContent?.trim() ?? ''; return { externalId: item.id || `${username}:${index}:${text.slice(0, 30)}`, username, text, profileSnippet: {} } }).filter((item) => item.username && item.text))
  return { broadcastId, interactions }
}

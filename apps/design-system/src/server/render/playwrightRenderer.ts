import type { Browser } from 'playwright'

export interface RenderOptions {
  width: number
  height: number
  scale?: number
  format?: 'png' | 'jpeg' | 'pdf'
  quality?: number
  timeout?: number
  waitForFonts?: boolean
}

export interface RenderResult {
  buffer: Buffer
  format: string
  width: number
  height: number
  duration: number
}

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browser) return browser
  const { chromium } = await import('playwright')
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })
  return browser
}

export async function renderHtml(
  html: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const start = Date.now()
  const b = await getBrowser()
  const page = await b.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.scale ?? 2,
  })

  try {
    await page.setContent(html, {
      waitUntil: 'networkidle',
      timeout: options.timeout ?? 30000,
    })

    if (options.waitForFonts !== false) {
      await page.evaluate(() => document.fonts.ready)
    }

    await page.waitForTimeout(100)

    let buffer: Buffer

    if (options.format === 'pdf') {
      buffer = await page.pdf({
        width: options.width,
        height: options.height,
        printBackground: true,
      })
    } else {
      buffer = await page.screenshot({
        type: options.format === 'jpeg' ? 'jpeg' : 'png',
        quality: options.format === 'jpeg' ? (options.quality ?? 90) : undefined,
        fullPage: false,
      })
    }

    return {
      buffer,
      format: options.format ?? 'png',
      width: options.width,
      height: options.height,
      duration: Date.now() - start,
    }
  } finally {
    await page.close()
  }
}

export async function renderUrl(
  url: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const start = Date.now()
  const b = await getBrowser()
  const page = await b.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.scale ?? 2,
  })

  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: options.timeout ?? 30000,
    })

    if (options.waitForFonts !== false) {
      await page.evaluate(() => document.fonts.ready)
    }

    await page.waitForTimeout(100)

    const buffer = await page.screenshot({
      type: options.format === 'jpeg' ? 'jpeg' : 'png',
      quality: options.format === 'jpeg' ? (options.quality ?? 90) : undefined,
      fullPage: false,
    })

    return {
      buffer,
      format: options.format ?? 'png',
      width: options.width,
      height: options.height,
      duration: Date.now() - start,
    }
  } finally {
    await page.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'
import { apiErrorResponse, invalidRequestResponse } from '@/lib/api-errors'
import { basePath } from '@/lib/base-path'

const Slide = z.object({ role: z.enum(['cover', 'content', 'cta']), title: z.string().max(180), body: z.string().max(900) })
const Body = z.object({
  slides: z.array(Slide).min(1).max(10),
  brasao: z.string().max(120).nullish(),
  eyebrow: z.string().max(120).nullish(),
}).strict()

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function slideHtml(slide: z.infer<typeof Slide>, brasaoUrl: string | null, eyebrow: string | null): string {
  const coverHead = slide.role === 'cover' && brasaoUrl
    ? `<div class="eyebrow-row"><img class="brasao" src="${brasaoUrl}"><div class="eyebrow">${escapeHtml(eyebrow ?? '')}</div></div>`
    : ''
  return `<section class="slide ${slide.role}">
    <div class="topbar"></div>
    <div class="wrap">${coverHead}
      <div class="title">${escapeHtml(slide.title)}</div>
      <div class="body">${escapeHtml(slide.body)}</div>
    </div>
    <div class="footer"><img class="logo" src="${basePath}/brand/${encodeURIComponent('01 LOGO ATAQUE - SEM FUNDO.png')}"><div class="cta">Link da BIO</div></div>
  </section>`
}

export async function POST(request: Request) {
  try { await requireRole('operator') } catch (error) { return apiErrorResponse(error) }
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidRequestResponse('invalid_request')
  const brasaoUrl = parsed.data.brasao ? `${basePath}/brand/brasoes/${encodeURIComponent(parsed.data.brasao)}` : null
  const css = `*{margin:0;padding:0;box-sizing:border-box}body{background:#222;font-family:Arial,Helvetica,sans-serif}.slide{width:540px;height:675px;background:#111;color:#fff;display:flex;flex-direction:column;margin:0 auto 24px}.topbar{height:9px;background:#E10600}.wrap{flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 45px}.eyebrow-row{display:flex;align-items:center;gap:15px;margin-bottom:18px}img.brasao{width:75px;height:75px;object-fit:contain}.eyebrow{font-size:19px;font-weight:700;letter-spacing:2px;color:#E10600}.title{font-size:31px;font-weight:900;line-height:1.25;margin-top:20px}.body{font-size:22px;color:#CCC;margin-top:14px;line-height:1.4}.footer{padding:24px 45px;border-top:1px solid #333;display:flex;justify-content:space-between;align-items:center}img.logo{height:36px;object-fit:contain}.cta{font-size:15px;color:#E10600;font-weight:700}`
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body>${parsed.data.slides.map((slide) => slideHtml(slide, brasaoUrl, parsed.data.eyebrow ?? null)).join('')}</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

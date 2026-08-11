import { registry } from '@plataforma/shared'
export const dynamic = 'force-dynamic'
export async function GET() { return new Response(await registry.metrics(), { headers: { 'content-type': registry.contentType } }) }

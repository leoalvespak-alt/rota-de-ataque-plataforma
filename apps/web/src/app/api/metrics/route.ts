import { registry } from '@plataforma/shared'
export async function GET() { return new Response(await registry.metrics(), { headers: { 'content-type': registry.contentType } }) }

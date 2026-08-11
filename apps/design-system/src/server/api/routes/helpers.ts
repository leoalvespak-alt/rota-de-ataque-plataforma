import type { Context } from 'hono'
import type { ZodType } from 'zod'

export async function body<T>(context: Context, schema: ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await context.req.json())
  if (!parsed.success) throw new ApiError(400, parsed.error.flatten())
  return parsed.data
}
export class ApiError extends Error { status: number; detail: unknown; constructor(status: number, detail: unknown) { super(typeof detail === 'string' ? detail : 'Dados inválidos'); this.status = status; this.detail = detail } }
export function notFound(resource = 'Recurso'): never { throw new ApiError(404, `${resource} não encontrado.`) }
export function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

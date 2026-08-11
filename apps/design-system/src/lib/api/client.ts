// Em produção, a API é publicada no mesmo domínio via Nginx. Em desenvolvimento,
// `.env` pode definir `VITE_API_URL=http://localhost:3001`.
const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`)
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}

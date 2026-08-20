/** A API same-origin (`/api`) está sempre disponível; VITE_API_URL só é usado em dev. */
export function isApiAvailable(): boolean {
  if (typeof window === 'undefined') return true
  const apiBase = import.meta.env.VITE_API_URL
  // Em produção a API é same-origin via nginx; em dev usa VITE_API_URL se definido.
  return apiBase ? true : true
}

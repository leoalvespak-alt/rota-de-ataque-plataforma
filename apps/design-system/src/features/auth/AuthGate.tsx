import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import { apiFetch } from '@/lib/api/client'

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'authenticated' | 'anonymous'>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bypassAuth = import.meta.env.VITE_E2E === '1'

  useEffect(() => {
    if (import.meta.env.VITE_E2E === '1') return
    apiFetch<{ authenticated: boolean }>('/auth/session')
      .then(() => setState('authenticated'))
      .catch(() => setState('anonymous'))
  }, [])

  if (bypassAuth) return children

  if (state === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-ui-bg"><Loader2 className="size-6 animate-spin text-brand-red" /></div>
  }
  if (state === 'authenticated') return children

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      setPassword('')
      setState('authenticated')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível autenticar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ui-bg p-6 text-ui-text">
      <form onSubmit={login} className="w-full max-w-sm rounded-xl border border-ui-border bg-ui-panel p-6 shadow-xl">
        <LockKeyhole className="mb-4 size-8 text-brand-red" />
        <h1 className="font-heading text-xl font-bold">Acesso ao Design System</h1>
        <p className="mb-5 mt-1 text-sm text-ui-muted">Use a senha operacional configurada na API.</p>
        <label className="text-xs text-ui-muted">Senha
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            minLength={12}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-ui-border bg-ui-panel2 px-3 py-2 text-ui-text focus:border-brand-red focus:outline-none"
          />
        </label>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <button disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting && <Loader2 className="size-4 animate-spin" />} Entrar
        </button>
      </form>
    </main>
  )
}

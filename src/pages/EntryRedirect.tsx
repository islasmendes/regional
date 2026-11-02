import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Entrada `/` e `/index.html` no GitHub Pages.
 * Se veio de /calculadora (via ?p= ou sessionStorage), NÃO manda para o painel/login.
 */
export function EntryRedirect() {
  const [params] = useSearchParams()
  const fromQuery = params.get('p')?.replace(/^\//, '').replace(/\/$/, '')

  let fromStorage: string | null = null
  try {
    const raw = sessionStorage.getItem('regional-redirect')
    if (raw) {
      fromStorage = raw.replace(/^\//, '').replace(/\/$/, '').split('?')[0]?.split('#')[0] ?? null
      sessionStorage.removeItem('regional-redirect')
    }
  } catch {
    fromStorage = null
  }

  const target = fromQuery || fromStorage
  if (target === 'calculadora') return <Navigate to="/calculadora" replace />
  if (target === 'performance') return <Navigate to="/performance" replace />
  return <Navigate to="/painel" replace />
}

const BASE = '/regional/'

/** Restaura deep-link vindo do 404.html do GitHub Pages. */
export function restoreRedirectFromSession(): void {
  const raw = sessionStorage.getItem('regional-redirect')
  if (!raw) return
  sessionStorage.removeItem('regional-redirect')
  const path = raw.replace(/^\//, '').replace(/\/$/, '')
  const target = !path || path === 'index.html' ? 'painel' : path
  window.history.replaceState(null, '', `${BASE}${target}`)
}

export function appBasename(): string {
  return '/regional'
}

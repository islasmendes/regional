const BASE = '/regional/'

const PUBLIC_ENTRY_PATHS = new Set(['calculadora', 'performance', 'painel'])

function normalizeEntryPath(raw: string): string {
  const path = raw
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .split('?')[0]
    ?.split('#')[0]
    ?.trim()
  if (!path || path === 'index.html') return 'painel'
  return path
}

/** Destino público vindo de ?p= ou do 404.html (sessionStorage). */
export function readEntryRedirect(): string | null {
  const fromQuery = new URLSearchParams(window.location.search).get('p')
  if (fromQuery) return normalizeEntryPath(fromQuery)

  const raw = sessionStorage.getItem('regional-redirect')
  if (!raw) return null
  return normalizeEntryPath(raw)
}

/** Restaura deep-link vindo do 404.html / pastas do GitHub Pages. */
export function restoreRedirectFromSession(): void {
  const target = readEntryRedirect()
  if (!target) return
  sessionStorage.removeItem('regional-redirect')
  window.history.replaceState(null, '', `${BASE}${target}`)
}

export function appBasename(): string {
  return '/regional'
}

export function isKnownPublicEntry(path: string): boolean {
  return PUBLIC_ENTRY_PATHS.has(normalizeEntryPath(path))
}

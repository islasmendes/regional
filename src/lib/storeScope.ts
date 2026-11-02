import type { StoreMeta } from '../firebase/types'

/** Escopo padrão das configs do painel: aplica em todas as lojas. */
export const STORE_SCOPE_ALL = 'TODOS' as const

export type StoreScope = typeof STORE_SCOPE_ALL | string

export function isStoreScopeAll(scope: StoreScope): boolean {
  return scope === STORE_SCOPE_ALL
}

/** Lojas ativas afetadas pelo escopo (TODOS = todas). */
export function resolveTargetSiglas(scope: StoreScope, stores: StoreMeta[]): string[] {
  const active = stores.filter((s) => s.active !== false)
  if (isStoreScopeAll(scope)) return active.map((s) => s.code)
  const match = active.find((s) => s.code === scope)
  return match ? [match.code] : []
}

/**
 * Sigla usada só para leitura/preview quando o escopo é TODOS
 * (primeira loja ativa — alterações ainda vão para todas).
 */
export function canonicalSigla(scope: StoreScope, stores: StoreMeta[]): string | null {
  if (isStoreScopeAll(scope)) {
    return stores.find((s) => s.active !== false)?.code ?? stores[0]?.code ?? null
  }
  return scope || null
}

export function storeScopeLabel(scope: StoreScope, storeCount: number): string {
  if (isStoreScopeAll(scope)) {
    return storeCount === 1 ? '1 loja' : `todas as ${storeCount} lojas`
  }
  return scope
}

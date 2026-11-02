import { get, onValue, ref, remove, set, update, type Unsubscribe } from 'firebase/database'
import { hashPassword, isStrongEnoughPassword } from '../lib/crypto'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import {
  lojaEmail,
  siglaIndexPath,
  siglasIndexPath,
  storeMetaPath,
  storeRootPath,
  storesIndexPath,
} from './paths'
import { provisionStoreAuth } from './storeAuth'
import type { StoreMeta } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function mapStore(code: string, meta: StoreMeta): StoreMeta {
  return {
    code: meta.code ?? code,
    passwordHash: meta.passwordHash,
    active: meta.active !== false,
    createdAt: meta.createdAt ?? nowIso(),
    updatedAt: meta.updatedAt ?? nowIso(),
    authEmail: meta.authEmail ?? lojaEmail(meta.code ?? code),
  }
}

function storesEqual(a: StoreMeta[], b: StoreMeta[]): boolean {
  if (a.length !== b.length) return false
  return a.every((store, index) => {
    const other = b[index]
    return (
      other != null &&
      store.code === other.code &&
      store.active === other.active &&
      store.passwordHash === other.passwordHash &&
      store.updatedAt === other.updatedAt &&
      store.authEmail === other.authEmail
    )
  })
}

export type StoreDataSummary = {
  kpiCount: number
  metaMonths: string[]
  resultMonths: string[]
  checkMonths: string[]
}

export type StoreUpsertResult = {
  store: StoreMeta
  /** true = sigla já existia; índice/senha reparados sem apagar KPIs/metas/results. */
  recovered: boolean
  summary: StoreDataSummary
}

function emptySummary(): StoreDataSummary {
  return { kpiCount: 0, metaMonths: [], resultMonths: [], checkMonths: [] }
}

function monthKeysOf(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  return Object.keys(node as Record<string, unknown>)
    .filter((key) => /^\d{4}-\d{2}$/.test(key))
    .sort()
}

/** Inventário leve do que a sigla ainda tem no RTDB (não apaga nada). */
export async function inspectStoreData(siglaInput: string): Promise<StoreDataSummary> {
  const sigla = assertLojaSigla(siglaInput)
  const snap = await get(ref(database, storeRootPath(sigla)))
  if (!snap.exists()) return emptySummary()
  const tree = snap.val() as {
    kpis?: Record<string, unknown>
    metas?: Record<string, unknown>
    results?: Record<string, unknown>
    managerChecks?: Record<string, unknown>
  }
  return {
    kpiCount: tree.kpis ? Object.keys(tree.kpis).length : 0,
    metaMonths: monthKeysOf(tree.metas),
    resultMonths: monthKeysOf(tree.results),
    checkMonths: monthKeysOf(tree.managerChecks),
  }
}

async function ensureSiglaIndex(code: string, createdAt?: string): Promise<boolean> {
  const indexRef = ref(database, siglaIndexPath(code))
  const snap = await get(indexRef)
  if (snap.exists()) return false
  await set(indexRef, {
    code,
    createdAt: createdAt ?? nowIso(),
    recoveredAt: nowIso(),
  })
  return true
}

/**
 * Varredura pontual de `stores/` (get, não listener contínuo) para achar lojas
 * com meta válida que sumiram do índice auxiliar.
 */
export async function discoverStoreCodesFromTree(): Promise<string[]> {
  const snap = await get(ref(database, storesIndexPath()))
  if (!snap.exists()) return []
  const tree = snap.val() as Record<string, { meta?: StoreMeta } | null>
  return Object.entries(tree)
    .filter(([, node]) => Boolean(node?.meta?.passwordHash))
    .map(([code]) => code.toUpperCase())
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Reatacha no índice toda loja que ainda tem `stores/{SIGLA}/meta`.
 * Não mexe em kpis / metas / results / managerChecks.
 */
export async function reconcileStoreIndex(): Promise<{
  codes: string[]
  repaired: string[]
}> {
  const [indexSnap, treeCodes] = await Promise.all([
    get(ref(database, siglasIndexPath())),
    discoverStoreCodesFromTree(),
  ])
  const indexed = new Set(
    indexSnap.exists()
      ? Object.keys(indexSnap.val() as Record<string, unknown>).map((c) => c.toUpperCase())
      : [],
  )
  const repaired: string[] = []
  for (const code of treeCodes) {
    if (indexed.has(code)) continue
    const metaSnap = await get(ref(database, storeMetaPath(code)))
    const createdAt = metaSnap.exists()
      ? ((metaSnap.val() as StoreMeta).createdAt ?? nowIso())
      : nowIso()
    const didRepair = await ensureSiglaIndex(code, createdAt)
    if (didRepair) repaired.push(code)
  }
  const codes = [...new Set([...indexed, ...treeCodes])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
  return { codes, repaired }
}

export async function listStores(): Promise<StoreMeta[]> {
  await reconcileStoreIndex()
  const indexSnap = await get(ref(database, siglasIndexPath()))
  if (!indexSnap.exists()) return []
  const codes = Object.keys(indexSnap.val() as Record<string, unknown>)
  const stores = await Promise.all(
    codes.map(async (rawCode) => {
      const code = rawCode.toUpperCase()
      const snap = await get(ref(database, storeMetaPath(code)))
      if (!snap.exists()) return null
      const meta = snap.val() as StoreMeta
      if (!meta?.passwordHash) return null
      return mapStore(code, meta)
    }),
  )
  return stores
    .filter((item): item is StoreMeta => item != null)
    .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
}

/**
 * Escuta índice + meta de cada loja (não o tree `stores/` contínuo).
 * No mount, reconcilia órfãs uma vez via get pontual.
 */
export function subscribeStores(callback: (stores: StoreMeta[]) => void): Unsubscribe {
  const metaUnsubs = new Map<string, Unsubscribe>()
  const latest = new Map<string, StoreMeta>()
  let lastEmitted: StoreMeta[] = []
  let cancelled = false

  const emit = () => {
    const next = [...latest.values()].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
    if (storesEqual(lastEmitted, next)) return
    lastEmitted = next
    callback(next)
  }

  const syncMetaListener = (code: string) => {
    if (metaUnsubs.has(code)) return
    metaUnsubs.set(
      code,
      onValue(ref(database, storeMetaPath(code)), (metaSnap) => {
        if (!metaSnap.exists()) {
          latest.delete(code)
          emit()
          return
        }
        const meta = metaSnap.val() as StoreMeta
        if (!meta?.passwordHash) {
          latest.delete(code)
          emit()
          return
        }
        latest.set(code, mapStore(code, meta))
        emit()
      }),
    )
  }

  const unsubIndex = onValue(ref(database, siglasIndexPath()), (snap) => {
    const codes = snap.exists()
      ? Object.keys(snap.val() as Record<string, unknown>).map((code) => code.toUpperCase())
      : []
    const codeSet = new Set(codes)

    for (const [code, unsub] of [...metaUnsubs.entries()]) {
      if (codeSet.has(code)) continue
      unsub()
      metaUnsubs.delete(code)
      latest.delete(code)
    }

    for (const code of codeSet) syncMetaListener(code)
    emit()
  })

  void (async () => {
    try {
      await reconcileStoreIndex()
    } catch {
      // Índice auxiliar pode falhar pontualmente; listener do índice segue.
    }
    if (cancelled) return
  })()

  return () => {
    cancelled = true
    unsubIndex()
    for (const unsub of metaUnsubs.values()) unsub()
    metaUnsubs.clear()
    latest.clear()
  }
}

/**
 * Cria loja nova OU recupera sigla órfã (meta/dados no RTDB sem índice).
 * Nunca apaga kpis / metas / results / managerChecks ao recuperar.
 */
export async function createStore(
  siglaInput: string,
  password: string,
): Promise<StoreUpsertResult> {
  const code = assertLojaSigla(siglaInput)
  const strength = isStrongEnoughPassword(password)
  if (strength) throw new Error(strength)

  const [existingMeta, existingIndex] = await Promise.all([
    get(ref(database, storeMetaPath(code))),
    get(ref(database, siglaIndexPath(code))),
  ])

  if (existingMeta.exists()) {
    const current = existingMeta.val() as StoreMeta
    const authEmail = await provisionStoreAuth(code, password)
    const next: StoreMeta = {
      ...current,
      code,
      passwordHash: await hashPassword(password),
      active: true,
      updatedAt: nowIso(),
      authEmail,
      createdAt: current.createdAt ?? nowIso(),
    }
    await update(ref(database), {
      [storeMetaPath(code)]: next,
      [siglaIndexPath(code)]: {
        code,
        createdAt: next.createdAt,
        recoveredAt: nowIso(),
      },
    })
    const summary = await inspectStoreData(code)
    return { store: next, recovered: true, summary }
  }

  // Índice órfão sem meta: remove só o ponteiro e cria do zero.
  if (existingIndex.exists()) {
    await remove(ref(database, siglaIndexPath(code)))
  }

  const authEmail = await provisionStoreAuth(code, password)

  const meta: StoreMeta = {
    code,
    passwordHash: await hashPassword(password),
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    authEmail,
  }

  await update(ref(database), {
    [storeMetaPath(code)]: meta,
    [siglaIndexPath(code)]: {
      code,
      createdAt: meta.createdAt,
    },
  })

  const summary = await inspectStoreData(code)
  return { store: meta, recovered: false, summary }
}

export async function updateStorePassword(siglaInput: string, password: string): Promise<void> {
  const code = assertLojaSigla(siglaInput)
  const strength = isStrongEnoughPassword(password)
  if (strength) throw new Error(strength)

  const metaRef = ref(database, storeMetaPath(code))
  const existing = await get(metaRef)
  if (!existing.exists()) throw new Error(`Loja ${code} não encontrada.`)
  const current = existing.val() as StoreMeta

  const authEmail = await provisionStoreAuth(code, password)

  const next: StoreMeta = {
    ...current,
    code,
    passwordHash: await hashPassword(password),
    updatedAt: nowIso(),
    authEmail,
  }
  await set(metaRef, next)
  await ensureSiglaIndex(code, next.createdAt)
}

export async function deleteStore(siglaInput: string): Promise<void> {
  const code = assertLojaSigla(siglaInput)
  await update(ref(database), {
    [storeRootPath(code)]: null,
    [siglaIndexPath(code)]: null,
  })
  // Conta Auth da loja pode ficar órfã sem a senha atual — remover no Console se precisar.
}

/** Remove só se não houver uso — helper para limpeza. */
export async function removeStoreNode(siglaInput: string): Promise<void> {
  await remove(ref(database, storeRootPath(assertLojaSigla(siglaInput))))
}

export function formatStoreSummary(summary: StoreDataSummary): string {
  const parts: string[] = []
  parts.push(`${summary.kpiCount} KPI(s)`)
  if (summary.metaMonths.length > 0) {
    parts.push(`metas em ${summary.metaMonths.join(', ')}`)
  }
  if (summary.resultMonths.length > 0) {
    parts.push(`reais em ${summary.resultMonths.join(', ')}`)
  }
  if (summary.checkMonths.length > 0) {
    parts.push(`checks em ${summary.checkMonths.join(', ')}`)
  }
  if (
    summary.kpiCount === 0 &&
    summary.metaMonths.length === 0 &&
    summary.resultMonths.length === 0 &&
    summary.checkMonths.length === 0
  ) {
    return 'sem dados históricos'
  }
  return parts.join(' · ')
}

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

export async function listStores(): Promise<StoreMeta[]> {
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
 * Escuta só o índice de siglas + meta de cada loja.
 * Não escuta `stores/` inteiro — senão cada gravação de metas/results
 * reemite a lista e remonta a matriz (apagando a outra visão).
 */
export function subscribeStores(callback: (stores: StoreMeta[]) => void): Unsubscribe {
  const metaUnsubs = new Map<string, Unsubscribe>()
  const latest = new Map<string, StoreMeta>()
  let lastEmitted: StoreMeta[] = []

  const emit = () => {
    const next = [...latest.values()].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
    if (storesEqual(lastEmitted, next)) return
    lastEmitted = next
    callback(next)
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

    for (const code of codeSet) {
      if (metaUnsubs.has(code)) continue
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

    emit()
  })

  return () => {
    unsubIndex()
    for (const unsub of metaUnsubs.values()) unsub()
    metaUnsubs.clear()
    latest.clear()
  }
}

export async function createStore(siglaInput: string, password: string): Promise<StoreMeta> {
  const code = assertLojaSigla(siglaInput)
  const strength = isStrongEnoughPassword(password)
  if (strength) throw new Error(strength)

  const [existingMeta, existingIndex] = await Promise.all([
    get(ref(database, storeMetaPath(code))),
    get(ref(database, siglaIndexPath(code))),
  ])
  if (existingMeta.exists() || existingIndex.exists()) {
    throw new Error(`A sigla ${code} já está em uso. Cada loja precisa de sigla única.`)
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
  return meta
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

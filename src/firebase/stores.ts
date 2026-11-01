import { get, onValue, ref, remove, set, type Unsubscribe } from 'firebase/database'
import { hashPassword, isStrongEnoughPassword } from '../lib/crypto'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeMetaPath, storeRootPath, storesIndexPath } from './paths'
import type { StoreMeta } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

export async function listStores(): Promise<StoreMeta[]> {
  const snap = await get(ref(database, storesIndexPath()))
  if (!snap.exists()) return []
  const tree = snap.val() as Record<string, { meta?: StoreMeta } | null>
  return Object.entries(tree)
    .map(([code, node]) => {
      const meta = node?.meta
      if (!meta?.passwordHash) return null
      return {
        code: meta.code ?? code,
        passwordHash: meta.passwordHash,
        active: meta.active !== false,
        createdAt: meta.createdAt ?? nowIso(),
        updatedAt: meta.updatedAt ?? nowIso(),
      } satisfies StoreMeta
    })
    .filter((item): item is StoreMeta => item != null)
    .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
}

export function subscribeStores(callback: (stores: StoreMeta[]) => void): Unsubscribe {
  return onValue(ref(database, storesIndexPath()), (snap) => {
    if (!snap.exists()) {
      callback([])
      return
    }
    const tree = snap.val() as Record<string, { meta?: StoreMeta } | null>
    const stores = Object.entries(tree)
      .map(([code, node]) => {
        const meta = node?.meta
        if (!meta?.passwordHash) return null
        return {
          code: meta.code ?? code,
          passwordHash: meta.passwordHash,
          active: meta.active !== false,
          createdAt: meta.createdAt ?? nowIso(),
          updatedAt: meta.updatedAt ?? nowIso(),
        } satisfies StoreMeta
      })
      .filter((item): item is StoreMeta => item != null)
      .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
    callback(stores)
  })
}

export async function createStore(siglaInput: string, password: string): Promise<StoreMeta> {
  const code = assertLojaSigla(siglaInput)
  const strength = isStrongEnoughPassword(password)
  if (strength) throw new Error(strength)

  const existing = await get(ref(database, storeMetaPath(code)))
  if (existing.exists()) throw new Error(`A loja ${code} já está cadastrada.`)

  const meta: StoreMeta = {
    code,
    passwordHash: await hashPassword(password),
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await set(ref(database, storeMetaPath(code)), meta)
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
  const next: StoreMeta = {
    ...current,
    code,
    passwordHash: await hashPassword(password),
    updatedAt: nowIso(),
  }
  await set(metaRef, next)
}

export async function deleteStore(siglaInput: string): Promise<void> {
  const code = assertLojaSigla(siglaInput)
  await remove(ref(database, storeRootPath(code)))
}

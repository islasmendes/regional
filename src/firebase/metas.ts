import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { getZonedNow } from '../lib/time'
import { database } from './config'
import { storeKpiMetaPath, storeMetasMonthPath, storeSubMetaPath } from './paths'
import type { MonthMetaEntry } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

export function currentMonthKey(timeZone?: string): string {
  return getZonedNow(timeZone).monthKey
}

export type MonthMetasTree = Record<
  string,
  Partial<MonthMetaEntry> & { subs?: Record<string, Partial<MonthMetaEntry>> }
>

export function subscribeMonthMetas(
  siglaInput: string,
  monthKey: string,
  callback: (tree: MonthMetasTree) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, storeMetasMonthPath(sigla, monthKey)), (snap) => {
    callback(snap.exists() ? (snap.val() as MonthMetasTree) : {})
  })
}

function metaEntry(valor: number): MonthMetaEntry {
  return {
    valor,
    updatedAt: nowIso(),
    updatedBy: 'painel',
  }
}

function explainFirebaseWriteError(error: unknown, label: string): Error {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : ''
  const message = error instanceof Error ? error.message : String(error)
  if (code.includes('PERMISSION_DENIED') || /permission_denied/i.test(message)) {
    return new Error(
      `${label}: RTDB negou a gravação. Publique as regras atuais de firebase/database.rules.json (paths metas e results).`,
    )
  }
  return error instanceof Error ? error : new Error(`${label}: ${message}`)
}

export async function saveKpiMonthMeta(params: {
  sigla: string
  monthKey: string
  kpiId: string
  valor: number
}): Promise<MonthMetaEntry> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Meta inválida.')
  const path = storeKpiMetaPath(sigla, params.monthKey, params.kpiId)
  const entry = metaEntry(params.valor)
  try {
    // Preserva /subs: lê o nó, grava valor sem apagar filhos.
    const snap = await get(ref(database, path))
    const prev = snap.exists() ? (snap.val() as Record<string, unknown>) : {}
    const { valor: _v, updatedAt: _a, updatedBy: _b, ...rest } = prev
    await set(ref(database, path), { ...rest, ...entry })
  } catch (error) {
    throw explainFirebaseWriteError(error, `Meta ${params.kpiId}`)
  }
  return entry
}

export async function saveSubMonthMeta(params: {
  sigla: string
  monthKey: string
  kpiId: string
  subId: string
  valor: number
}): Promise<MonthMetaEntry> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Meta inválida.')
  const entry = metaEntry(params.valor)
  try {
    await set(ref(database, storeSubMetaPath(sigla, params.monthKey, params.kpiId, params.subId)), entry)
  } catch (error) {
    throw explainFirebaseWriteError(error, `Meta sub ${params.subId}`)
  }
  return entry
}

export async function readKpiMonthMeta(
  siglaInput: string,
  monthKey: string,
  kpiId: string,
): Promise<MonthMetaEntry | null> {
  const sigla = assertLojaSigla(siglaInput)
  const snap = await get(ref(database, storeKpiMetaPath(sigla, monthKey, kpiId)))
  if (!snap.exists()) return null
  const val = snap.val() as Partial<MonthMetaEntry>
  if (typeof val.valor !== 'number') return null
  return {
    valor: val.valor,
    updatedAt: val.updatedAt ?? nowIso(),
    updatedBy: 'painel',
  }
}

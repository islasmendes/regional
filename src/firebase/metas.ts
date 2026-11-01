import { get, onValue, ref, set, update, type Unsubscribe } from 'firebase/database'
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

export async function saveKpiMonthMeta(params: {
  sigla: string
  monthKey: string
  kpiId: string
  valor: number
}): Promise<MonthMetaEntry> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Meta inválida.')
  const entry: MonthMetaEntry = {
    valor: params.valor,
    updatedAt: nowIso(),
    updatedBy: 'painel',
  }
  // update preserva nó /subs do mesmo KPI no mês
  await update(ref(database, storeKpiMetaPath(sigla, params.monthKey, params.kpiId)), entry)
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
  const entry: MonthMetaEntry = {
    valor: params.valor,
    updatedAt: nowIso(),
    updatedBy: 'painel',
  }
  await set(ref(database, storeSubMetaPath(sigla, params.monthKey, params.kpiId, params.subId)), entry)
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

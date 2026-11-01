import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeManagerChecksPath } from './paths'
import type { CheckEntryTipo, ManagerCheckEntry } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function entryPath(sigla: string, monthKey: string, kpiId: string, dayKey: string, tipo: CheckEntryTipo) {
  return `${storeManagerChecksPath(sigla, monthKey)}/${kpiId}/${dayKey}/${tipo}`
}

export type DayCheckMap = Record<
  string,
  Partial<Record<CheckEntryTipo, ManagerCheckEntry | null>> | null
>

export function subscribeDayChecks(
  siglaInput: string,
  monthKey: string,
  dayKey: string,
  callback: (byKpi: DayCheckMap) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, storeManagerChecksPath(sigla, monthKey)), (snap) => {
    if (!snap.exists()) {
      callback({})
      return
    }
    const tree = snap.val() as Record<string, Record<string, Partial<Record<CheckEntryTipo, ManagerCheckEntry>>>>
    const byKpi: DayCheckMap = {}
    for (const [kpiId, days] of Object.entries(tree)) {
      byKpi[kpiId] = days?.[dayKey] ?? null
    }
    callback(byKpi)
  })
}

export async function saveManagerCheckEntry(params: {
  sigla: string
  monthKey: string
  dayKey: string
  kpiId: string
  tipo: CheckEntryTipo
  valor: number
}): Promise<ManagerCheckEntry> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Valor inválido.')
  const entry: ManagerCheckEntry = {
    valor: params.valor,
    updatedAt: nowIso(),
    updatedBy: 'gestor',
  }
  await set(
    ref(database, entryPath(sigla, params.monthKey, params.kpiId, params.dayKey, params.tipo)),
    entry,
  )
  return entry
}

export async function readManagerCheckEntry(params: {
  sigla: string
  monthKey: string
  dayKey: string
  kpiId: string
  tipo: CheckEntryTipo
}): Promise<ManagerCheckEntry | null> {
  const sigla = assertLojaSigla(params.sigla)
  const snap = await get(
    ref(database, entryPath(sigla, params.monthKey, params.kpiId, params.dayKey, params.tipo)),
  )
  if (!snap.exists()) return null
  return snap.val() as ManagerCheckEntry
}

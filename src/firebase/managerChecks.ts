import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeManagerChecksPath } from './paths'
import type { CheckEntryTipo, ManagerCheckEntry } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function kpiEntryPath(
  sigla: string,
  monthKey: string,
  kpiId: string,
  dayKey: string,
  tipo: CheckEntryTipo,
) {
  return `${storeManagerChecksPath(sigla, monthKey)}/${kpiId}/${dayKey}/${tipo}`
}

function subEntryPath(
  sigla: string,
  monthKey: string,
  kpiId: string,
  subId: string,
  dayKey: string,
  tipo: CheckEntryTipo,
) {
  return `${storeManagerChecksPath(sigla, monthKey)}/${kpiId}/subs/${subId}/${dayKey}/${tipo}`
}

export type DayCheckSlot = Partial<Record<CheckEntryTipo, ManagerCheckEntry | null>>

export type DayCheckMap = Record<
  string,
  (DayCheckSlot & { subs?: Record<string, DayCheckSlot> }) | null
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
    const tree = snap.val() as Record<
      string,
      Record<string, unknown> & {
        subs?: Record<string, Record<string, DayCheckSlot>>
      }
    >
    const byKpi: DayCheckMap = {}
    for (const [kpiId, node] of Object.entries(tree)) {
      const day = (node?.[dayKey] as DayCheckSlot | undefined) ?? null
      const subsRaw = node?.subs
      const subs: Record<string, DayCheckSlot> = {}
      if (subsRaw && typeof subsRaw === 'object') {
        for (const [subId, subDays] of Object.entries(subsRaw)) {
          const subDay = subDays?.[dayKey]
          if (subDay) subs[subId] = subDay
        }
      }
      byKpi[kpiId] = {
        ...(day ?? {}),
        ...(Object.keys(subs).length > 0 ? { subs } : {}),
      }
    }
    callback(byKpi)
  })
}

export async function saveManagerCheckEntry(params: {
  sigla: string
  monthKey: string
  dayKey: string
  kpiId: string
  subId?: string
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
  const path = params.subId
    ? subEntryPath(sigla, params.monthKey, params.kpiId, params.subId, params.dayKey, params.tipo)
    : kpiEntryPath(sigla, params.monthKey, params.kpiId, params.dayKey, params.tipo)
  await set(ref(database, path), entry)
  return entry
}

export async function readManagerCheckEntry(params: {
  sigla: string
  monthKey: string
  dayKey: string
  kpiId: string
  subId?: string
  tipo: CheckEntryTipo
}): Promise<ManagerCheckEntry | null> {
  const sigla = assertLojaSigla(params.sigla)
  const path = params.subId
    ? subEntryPath(sigla, params.monthKey, params.kpiId, params.subId, params.dayKey, params.tipo)
    : kpiEntryPath(sigla, params.monthKey, params.kpiId, params.dayKey, params.tipo)
  const snap = await get(ref(database, path))
  if (!snap.exists()) return null
  return snap.val() as ManagerCheckEntry
}

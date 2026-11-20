import { get, onValue, push, ref, set, update, type Unsubscribe } from 'firebase/database'
import { database } from '../../firebase/config'
import { monthKey, toIsoDate } from '../domain/dates'
import { buildForecastHistoryEntry } from '../domain/recurrence'
import type {
  ActiveBase,
  ContractJustification,
  ContractRecord,
  ForecastHistoryEntry,
  SimBlank,
  StoreClosingInput,
  VfCommitments,
} from '../domain/types'
import { importNewBaseFromFile } from '../parse/excelImport'
import {
  contratosActivePath,
  contratosClosingStorePath,
  contratosForecastContractPath,
  contratosForecastHistoryPath,
  contratosImportLogPath,
  contratosJustificationPath,
  contratosJustificationsPath,
  encodeContractKey,
} from './paths'

function nowIso(): string {
  return new Date().toISOString()
}

type ActivePersisted = {
  meta: ActiveBase['meta']
  contracts: Record<string, ContractRecord>
}

function toActiveBase(raw: ActivePersisted | null | undefined): ActiveBase | null {
  if (!raw?.meta || !raw.contracts) return null
  return {
    meta: raw.meta,
    contracts: Object.values(raw.contracts),
  }
}

export function subscribeActiveBase(callback: (base: ActiveBase | null) => void): Unsubscribe {
  return onValue(ref(database, contratosActivePath()), (snap) => {
    if (!snap.exists()) {
      callback(null)
      return
    }
    callback(toActiveBase(snap.val() as ActivePersisted))
  })
}

export function subscribeJustifications(
  callback: (map: Record<string, ContractJustification>) => void,
): Unsubscribe {
  return onValue(ref(database, contratosJustificationsPath()), (snap) => {
    if (!snap.exists()) {
      callback({})
      return
    }
    const tree = snap.val() as Record<string, ContractJustification>
    const out: Record<string, ContractJustification> = {}
    for (const value of Object.values(tree)) {
      if (value?.contractId) out[value.contractId] = value
    }
    callback(out)
  })
}

export function subscribeForecastHistory(
  callback: (entries: ForecastHistoryEntry[]) => void,
): Unsubscribe {
  return onValue(ref(database, contratosForecastHistoryPath()), (snap) => {
    if (!snap.exists()) {
      callback([])
      return
    }
    const tree = snap.val() as Record<string, Record<string, ForecastHistoryEntry>>
    const entries: ForecastHistoryEntry[] = []
    for (const byContract of Object.values(tree)) {
      for (const entry of Object.values(byContract ?? {})) {
        if (entry?.contractId && entry.previsaoFat) entries.push(entry)
      }
    }
    callback(entries)
  })
}

export function normalizeClosingInput(
  sigla: string,
  raw: Partial<StoreClosingInput> | null | undefined,
): StoreClosingInput {
  const base = emptyClosing(sigla)
  if (!raw) return base
  return {
    sigla: (raw.sigla ?? sigla).toUpperCase(),
    metaMensal: typeof raw.metaMensal === 'number' ? raw.metaMensal : null,
    metaDesafio: typeof raw.metaDesafio === 'number' ? raw.metaDesafio : null,
    vendasAcumuladas: typeof raw.vendasAcumuladas === 'number' ? raw.vendasAcumuladas : null,
    faturamentoAcumulado:
      typeof raw.faturamentoAcumulado === 'number' ? raw.faturamentoAcumulado : null,
    vf: raw.vf && typeof raw.vf === 'object' ? raw.vf : {},
  }
}

export function subscribeClosingMonth(
  month: string,
  callback: (bySigla: Record<string, StoreClosingInput>) => void,
): Unsubscribe {
  return onValue(ref(database, `contratos/closing/${month}`), (snap) => {
    if (!snap.exists()) {
      callback({})
      return
    }
    const tree = snap.val() as Record<string, Partial<StoreClosingInput>>
    const normalized: Record<string, StoreClosingInput> = {}
    for (const [sigla, raw] of Object.entries(tree)) {
      normalized[sigla.toUpperCase()] = normalizeClosingInput(sigla, raw)
    }
    callback(normalized)
  })
}

/**
 * Importação atômica:
 * 1) valida arquivo
 * 2) substitui `contratos/active` por completo
 * 3) zera justificativas do ciclo
 * 4) registra log
 * Em falha: não grava nada (base anterior permanece).
 */
export async function commitImportFromFile(input: {
  buffer: ArrayBuffer
  fileName: string
}): Promise<{ ok: true; count: number; removedCount: number } | { ok: false; error: string }> {
  const previousSnap = await get(ref(database, contratosActivePath()))
  const previous = previousSnap.exists()
    ? toActiveBase(previousSnap.val() as ActivePersisted)
    : null

  const result = importNewBaseFromFile({
    buffer: input.buffer,
    fileName: input.fileName,
    previous,
    allowEmpty: true,
  })

  if (!result.ok) {
    const logRef = push(ref(database, contratosImportLogPath()))
    await set(logRef, {
      at: nowIso(),
      fileName: input.fileName,
      ok: false,
      error: result.error,
      count: 0,
    })
    return { ok: false, error: result.error }
  }

  const contractsMap: Record<string, ContractRecord> = {}
  for (const c of result.base.contracts) {
    contractsMap[encodeContractKey(c.id)] = c
  }

  const logRef = push(ref(database, contratosImportLogPath()))
  await update(ref(database), {
    [contratosActivePath()]: {
      meta: result.base.meta,
      contracts: contractsMap,
    },
    [contratosJustificationsPath()]: null,
    [`${contratosImportLogPath()}/${logRef.key}`]: {
      at: nowIso(),
      fileName: input.fileName,
      ok: true,
      count: result.base.meta.recordCount,
      removedCount: result.removedCount,
      previousCount: result.previousCount,
    },
  })

  return {
    ok: true,
    count: result.base.meta.recordCount,
    removedCount: result.removedCount,
  }
}

export async function saveJustification(input: {
  contract: ContractRecord
  consorcio: SimBlank
  financiamentoExterno: SimBlank
  previsaoFat: string | null
  justificativa: string
  cycleDate: string
}): Promise<void> {
  const justification: ContractJustification = {
    contractId: input.contract.id,
    consorcio: input.consorcio,
    financiamentoExterno: input.financiamentoExterno,
    previsaoFat: input.previsaoFat,
    justificativa: input.justificativa,
    updatedAt: nowIso(),
  }

  const updates: Record<string, unknown> = {
    [contratosJustificationPath(input.contract.id)]: justification,
  }

  if (input.previsaoFat) {
    const entryRef = push(ref(database, contratosForecastContractPath(input.contract.id)))
    const entry = buildForecastHistoryEntry({
      contract: input.contract,
      previsaoFat: input.previsaoFat,
      cycleDate: input.cycleDate,
      recordedAt: nowIso(),
      entryId: entryRef.key ?? `${Date.now()}`,
    })
    updates[`${contratosForecastContractPath(input.contract.id)}/${entry.id}`] = entry
  }

  await update(ref(database), updates)
}

export async function saveStoreClosing(input: StoreClosingInput & { monthKey?: string }): Promise<void> {
  const month = input.monthKey ?? monthKey(toIsoDate(new Date()))
  const payload: StoreClosingInput = {
    sigla: input.sigla.toUpperCase(),
    metaMensal: input.metaMensal,
    metaDesafio: input.metaDesafio,
    vendasAcumuladas: input.vendasAcumuladas,
    faturamentoAcumulado: input.faturamentoAcumulado,
    vf: input.vf ?? ({} as VfCommitments),
  }
  await set(ref(database, contratosClosingStorePath(month, payload.sigla)), payload)
}

export function emptyClosing(sigla: string): StoreClosingInput {
  return {
    sigla: sigla.toUpperCase(),
    metaMensal: null,
    metaDesafio: null,
    vendasAcumuladas: null,
    faturamentoAcumulado: null,
    vf: {},
  }
}

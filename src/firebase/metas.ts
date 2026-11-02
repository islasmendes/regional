import { onValue, ref, update, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { getZonedNow } from '../lib/time'
import { database } from './config'
import { storeMetasMonthPath } from './paths'
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

function explainFirebaseWriteError(error: unknown, label: string): Error {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : ''
  const message = error instanceof Error ? error.message : String(error)
  if (code.includes('PERMISSION_DENIED') || /permission_denied/i.test(message)) {
    return new Error(
      `${label}: RTDB negou a gravação. Confirme login master e regras de metas/{mês}.`,
    )
  }
  return error instanceof Error ? error : new Error(`${label}: ${message}`)
}

/** Grava só folhas da meta — não toca results nem outras chaves irmãs. */
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
  try {
    await update(ref(database, storeMetasMonthPath(sigla, params.monthKey)), {
      [`${params.kpiId}/valor`]: entry.valor,
      [`${params.kpiId}/updatedAt`]: entry.updatedAt,
      [`${params.kpiId}/updatedBy`]: entry.updatedBy,
    })
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
  const entry: MonthMetaEntry = {
    valor: params.valor,
    updatedAt: nowIso(),
    updatedBy: 'painel',
  }
  try {
    await update(ref(database, storeMetasMonthPath(sigla, params.monthKey)), {
      [`${params.kpiId}/subs/${params.subId}/valor`]: entry.valor,
      [`${params.kpiId}/subs/${params.subId}/updatedAt`]: entry.updatedAt,
      [`${params.kpiId}/subs/${params.subId}/updatedBy`]: entry.updatedBy,
    })
  } catch (error) {
    throw explainFirebaseWriteError(error, `Meta sub ${params.subId}`)
  }
  return entry
}

import { ref, update } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeResultsPath } from './paths'

function nowIso(): string {
  return new Date().toISOString()
}

function explainFirebaseWriteError(error: unknown, label: string): Error {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : ''
  const message = error instanceof Error ? error.message : String(error)
  if (code.includes('PERMISSION_DENIED') || /permission_denied/i.test(message)) {
    return new Error(
      `${label}: RTDB negou a gravação. Confirme login master e regras de results/{mês}.`,
    )
  }
  return error instanceof Error ? error : new Error(`${label}: ${message}`)
}

/** Override de Real no painel — path isolado de metas; manda sobre o checkout. */
export async function saveKpiMonthResult(params: {
  sigla: string
  monthKey: string
  kpiId: string
  valor: number
}): Promise<void> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Resultado inválido.')
  const updatedAt = nowIso()
  try {
    await update(ref(database, storeResultsPath(sigla, params.monthKey)), {
      [`${params.kpiId}/valor`]: params.valor,
      [`${params.kpiId}/updatedAt`]: updatedAt,
      [`${params.kpiId}/updatedBy`]: 'painel',
    })
  } catch (error) {
    throw explainFirebaseWriteError(error, `Real ${params.kpiId}`)
  }
}

export async function saveSubMonthResult(params: {
  sigla: string
  monthKey: string
  kpiId: string
  subId: string
  valor: number
}): Promise<void> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Resultado inválido.')
  const updatedAt = nowIso()
  try {
    await update(ref(database, storeResultsPath(sigla, params.monthKey)), {
      [`${params.kpiId}/subs/${params.subId}/valor`]: params.valor,
      [`${params.kpiId}/subs/${params.subId}/updatedAt`]: updatedAt,
      [`${params.kpiId}/subs/${params.subId}/updatedBy`]: 'painel',
    })
  } catch (error) {
    throw explainFirebaseWriteError(error, `Real sub ${params.subId}`)
  }
}

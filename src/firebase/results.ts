import { get, ref, set, update } from 'firebase/database'
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
      `${label}: RTDB negou a gravação. Publique as regras atuais (path results).`,
    )
  }
  return error instanceof Error ? error : new Error(`${label}: ${message}`)
}

/** Override de Real no painel — manda sobre o checkout. */
export async function saveKpiMonthResult(params: {
  sigla: string
  monthKey: string
  kpiId: string
  valor: number
}): Promise<void> {
  const sigla = assertLojaSigla(params.sigla)
  if (!Number.isFinite(params.valor)) throw new Error('Resultado inválido.')
  const path = `${storeResultsPath(sigla, params.monthKey)}/${params.kpiId}`
  const entry = {
    valor: params.valor,
    updatedAt: nowIso(),
    updatedBy: 'painel' as const,
  }
  try {
    const snap = await get(ref(database, path))
    const prev = snap.exists() ? (snap.val() as Record<string, unknown>) : {}
    const { valor: _v, updatedAt: _a, updatedBy: _b, ...rest } = prev
    await set(ref(database, path), { ...rest, ...entry })
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
  try {
    await update(
      ref(database, `${storeResultsPath(sigla, params.monthKey)}/${params.kpiId}/subs/${params.subId}`),
      {
        valor: params.valor,
        updatedAt: nowIso(),
        updatedBy: 'painel',
      },
    )
  } catch (error) {
    throw explainFirebaseWriteError(error, `Real sub ${params.subId}`)
  }
}

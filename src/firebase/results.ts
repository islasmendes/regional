import { ref, update } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeResultsPath } from './paths'

function nowIso(): string {
  return new Date().toISOString()
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
  await update(ref(database, `${storeResultsPath(sigla, params.monthKey)}/${params.kpiId}`), {
    valor: params.valor,
    updatedAt: nowIso(),
    updatedBy: 'painel',
  })
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
  await update(
    ref(database, `${storeResultsPath(sigla, params.monthKey)}/${params.kpiId}/subs/${params.subId}`),
    {
      valor: params.valor,
      updatedAt: nowIso(),
      updatedBy: 'painel',
    },
  )
}

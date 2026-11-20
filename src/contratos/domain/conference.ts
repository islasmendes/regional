import type { ConferenceStatus } from './types'

/**
 * VENDAS TOTAIS ACUMULADAS = FATURAMENTO ACUMULADO + CONTRATOS EM ABERTO
 */
export function evaluateConference(input: {
  vendasAcumuladas: number | null
  faturamentoAcumulado: number | null
  contratosAbertos: number
}): { status: ConferenceStatus; delta: number | null } {
  const { vendasAcumuladas: v, faturamentoAcumulado: f, contratosAbertos: a } = input

  if (v == null || f == null) {
    return { status: 'PENDENTE', delta: null }
  }

  const expected = f + a
  const delta = v - expected
  if (delta === 0) return { status: 'OK', delta: 0 }
  return { status: 'DIVERGENCIA', delta }
}

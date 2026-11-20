import { sameContractFamily } from './contractId'
import type { ContractRecord, ForecastHistoryEntry } from './types'

/**
 * Identifica previsões vencidas de contratos que ainda estão abertos.
 * Não marca contrato que já saiu da base.
 * Não restaura justificativa anterior.
 */
export function findBrokenPromises(input: {
  activeContracts: ContractRecord[]
  history: ForecastHistoryEntry[]
  todayIso: string
}): Map<string, ForecastHistoryEntry> {
  const broken = new Map<string, ForecastHistoryEntry>()
  const active = input.activeContracts

  for (const entry of input.history) {
    if (entry.previsaoFat >= input.todayIso) continue

    const match = active.find(
      (c) =>
        c.id === entry.contractId ||
        sameContractFamily(c, {
          codigoPrimeiroContrato: entry.codigoPrimeiroContrato,
          codigoContratoAtual: entry.codigoContratoAtual,
          placa: entry.placa,
        }),
    )
    if (!match) continue

    const prev = broken.get(match.id)
    if (!prev || entry.previsaoFat > prev.previsaoFat) {
      broken.set(match.id, { ...entry, contractId: match.id })
    }
  }

  return broken
}

export const BROKEN_PROMISE_LABEL = 'PREVISÃO NÃO CUMPRIDA — CONTRATO RECORRENTE'

/**
 * Ao gravar uma previsão no ciclo atual, registra no histórico técnico.
 */
export function buildForecastHistoryEntry(input: {
  contract: ContractRecord
  previsaoFat: string
  cycleDate: string
  recordedAt: string
  entryId: string
}): ForecastHistoryEntry {
  return {
    id: input.entryId,
    contractId: input.contract.id,
    previsaoFat: input.previsaoFat,
    recordedAt: input.recordedAt,
    cycleDate: input.cycleDate,
    placa: input.contract.placa,
    codigoContratoAtual: input.contract.codigoContratoAtual,
    codigoPrimeiroContrato: input.contract.codigoPrimeiroContrato,
  }
}

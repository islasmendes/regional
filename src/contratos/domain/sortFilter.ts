import type { EnrichedContract } from './types'

export type SortKey =
  | 'loja'
  | 'placa'
  | 'diasAbertoPrimeiro'
  | 'diasAbertoAtual'
  | 'cvEv'
  | 'previsaoFat'
  | 'valorConciliado'
  | 'criticos'

export type SortDir = 'asc' | 'desc'

export type JustificationFilters = {
  loja?: string
  consorcio?: 'SIM' | 'BLANK' | 'ALL'
  financiamentoExterno?: 'SIM' | 'BLANK' | 'ALL'
  semPrevisao?: boolean
  criticosPrimeiro?: boolean
  brokenOnly?: boolean
  query?: string
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

function cmpNum(a: number | null, b: number | null, dir: SortDir): number {
  const av = a == null ? (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : a
  const bv = b == null ? (dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : b
  return av - bv
}

/**
 * Ordena movendo o registro completo (enriched).
 * A justificativa permanece vinculada ao contractId.
 */
export function sortContracts(
  list: EnrichedContract[],
  key: SortKey,
  dir: SortDir = 'asc',
): EnrichedContract[] {
  const mul = dir === 'asc' ? 1 : -1
  const copy = [...list]

  copy.sort((a, b) => {
    if (key === 'criticos' || (key === 'diasAbertoPrimeiro' && dir === 'desc')) {
      // Críticos (>7) primeiro, depois por dias desc
      const ca = (a.diasAbertoPrimeiro ?? 0) > 7 ? 1 : 0
      const cb = (b.diasAbertoPrimeiro ?? 0) > 7 ? 1 : 0
      if (ca !== cb) return cb - ca
    }

    let primary = 0
    switch (key) {
      case 'loja':
        primary = cmpStr(a.loja, b.loja)
        break
      case 'placa':
        primary = cmpStr(a.placa, b.placa)
        break
      case 'diasAbertoPrimeiro':
        primary = cmpNum(a.diasAbertoPrimeiro, b.diasAbertoPrimeiro, dir)
        return primary * mul || cmpStr(a.placa, b.placa)
      case 'diasAbertoAtual':
        primary = cmpNum(a.diasAbertoAtual, b.diasAbertoAtual, dir)
        return primary * mul || cmpStr(a.placa, b.placa)
      case 'cvEv':
        primary = cmpStr(a.cvEv, b.cvEv)
        break
      case 'previsaoFat': {
        const pa = a.justification?.previsaoFat ?? ''
        const pb = b.justification?.previsaoFat ?? ''
        // Sem previsão no fim quando asc; no início quando queremos pendências
        if (!pa && pb) return 1
        if (pa && !pb) return -1
        primary = cmpStr(pa, pb)
        break
      }
      case 'valorConciliado':
        primary = cmpNum(a.valorConciliado, b.valorConciliado, dir)
        return primary * mul || cmpStr(a.placa, b.placa)
      case 'criticos':
        primary = cmpNum(a.diasAbertoPrimeiro, b.diasAbertoPrimeiro, 'desc')
        return primary || cmpStr(a.placa, b.placa)
      default:
        primary = 0
    }
    return primary * mul || cmpStr(a.placa, b.placa)
  })

  return copy
}

export function filterContracts(
  list: EnrichedContract[],
  filters: JustificationFilters,
): EnrichedContract[] {
  return list.filter((c) => {
    if (filters.loja && filters.loja !== 'TODAS' && c.loja.toUpperCase() !== filters.loja.toUpperCase()) {
      return false
    }
    if (filters.consorcio === 'SIM' && c.justification?.consorcio !== 'SIM') return false
    if (filters.consorcio === 'BLANK' && c.justification?.consorcio === 'SIM') return false
    if (filters.financiamentoExterno === 'SIM' && c.justification?.financiamentoExterno !== 'SIM') {
      return false
    }
    if (
      filters.financiamentoExterno === 'BLANK' &&
      c.justification?.financiamentoExterno === 'SIM'
    ) {
      return false
    }
    if (filters.semPrevisao && c.justification?.previsaoFat) return false
    if (filters.brokenOnly && !c.brokenPromise) return false
    if (filters.query) {
      const q = filters.query.trim().toUpperCase()
      if (
        q &&
        !c.placa.includes(q) &&
        !c.loja.includes(q) &&
        !c.cvEv.toUpperCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })
}

/** Aplica filtro + ordenação preservando vínculo id ↔ justificativa. */
export function queryContracts(
  list: EnrichedContract[],
  filters: JustificationFilters,
  sortKey: SortKey,
  sortDir: SortDir,
): EnrichedContract[] {
  let result = filterContracts(list, filters)
  if (filters.criticosPrimeiro && sortKey !== 'criticos') {
    result = sortContracts(result, 'criticos', 'desc')
    // re-sort within? For now criticosPrimeiro forces criticals first via stable secondary
    const crit = result.filter((c) => (c.diasAbertoPrimeiro ?? 0) > 7)
    const rest = result.filter((c) => (c.diasAbertoPrimeiro ?? 0) <= 7)
    return [...sortContracts(crit, sortKey, sortDir), ...sortContracts(rest, sortKey, sortDir)]
  }
  return sortContracts(result, sortKey, sortDir)
}

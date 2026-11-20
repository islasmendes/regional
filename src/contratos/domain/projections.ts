import { evaluateConference } from './conference'
import {
  addDays,
  endOfMonth,
  monthKey,
  remainingDaysInMonth,
  startOfNextMonth,
} from './dates'
import { RSDSU_SIGLAS } from './lojas'
import type {
  ContractJustification,
  ContractRecord,
  EnrichedContract,
  RegionalClosingView,
  StoreClosingInput,
  StoreClosingView,
  VfCommitments,
} from './types'

function sumVf(vf: VfCommitments | null | undefined, days: string[]): number {
  if (!vf) return 0
  let total = 0
  for (const d of days) {
    const n = vf[d]
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) total += Math.floor(n)
  }
  return total
}

/**
 * Conta faturamentos previstos de contratos abertos em uma data específica.
 * Não conta previsão vencida como realizado.
 */
export function countForecastOnDate(
  contracts: EnrichedContract[],
  isoDate: string,
): number {
  return contracts.filter((c) => c.justification?.previsaoFat === isoDate).length
}

export function buildStoreClosingView(input: {
  sigla: string
  contracts: EnrichedContract[]
  closing: StoreClosingInput
  todayIso: string
}): StoreClosingView {
  const { todayIso } = input
  const endMes = endOfMonth(todayIso)
  const nextMonthStart = startOfNextMonth(todayIso)
  const d1 = addDays(todayIso, 1)
  const d2 = addDays(todayIso, 2)
  const d3 = addDays(todayIso, 3)

  const storeContracts = input.contracts.filter(
    (c) => c.loja.toUpperCase() === input.sigla.toUpperCase(),
  )

  const consorcios = storeContracts.filter((c) => c.justification?.consorcio === 'SIM').length
  const financiamentosExternos = storeContracts.filter(
    (c) => c.justification?.financiamentoExterno === 'SIM',
  ).length

  let fatHoje = 0
  let fatD1 = 0
  let fatD2 = 0
  let fatD3 = 0
  let fatRestanteMes = 0
  let fatProximoMes = 0
  let totalComPrevisaoMes = 0
  let semPrevisao = 0
  let previsoesDescumpridas = 0
  let previstosNoMes = 0
  let vnfProjetadoCount = 0

  for (const c of storeContracts) {
    if (c.brokenPromise) previsoesDescumpridas += 1

    const prev = c.justification?.previsaoFat ?? null
    if (!prev) {
      semPrevisao += 1
      vnfProjetadoCount += 1
      continue
    }

    if (prev < todayIso) {
      // Previsão vencida: não conta como faturamento do mês; segue como VNF pendente
      vnfProjetadoCount += 1
      continue
    }

    if (prev === todayIso) fatHoje += 1
    else if (prev === d1) fatD1 += 1
    else if (prev === d2) fatD2 += 1
    else if (prev === d3) fatD3 += 1

    if (monthKey(prev) === monthKey(todayIso) && prev <= endMes) {
      totalComPrevisaoMes += 1
      previstosNoMes += 1
      if (prev > d3) fatRestanteMes += 1
    } else if (prev >= nextMonthStart) {
      fatProximoMes += 1
      vnfProjetadoCount += 1
    } else {
      // Previsão fora do mês corrente (já coberto) — VNF
      vnfProjetadoCount += 1
    }
  }

  const contratosAbertos = storeContracts.length
  const conf = evaluateConference({
    vendasAcumuladas: input.closing.vendasAcumuladas,
    faturamentoAcumulado: input.closing.faturamentoAcumulado,
    contratosAbertos,
  })

  const daysLeft = remainingDaysInMonth(todayIso)
  const vfHoje = sumVf(input.closing.vf, [todayIso])
  const vfFuturoMes = sumVf(
    input.closing.vf,
    daysLeft.filter((d) => d !== todayIso),
  )
  const vfMes = vfHoje + vfFuturoMes

  const projecaoValida = conf.status === 'OK'
  let projecaoVendas: number | null = null
  let projecaoFaturamento: number | null = null
  let pctMeta: number | null = null
  let pctMetaDesafio: number | null = null
  let vnfAtual: number | null = null
  let vnfProjetado: number | null = null
  let pctVnfMeta: number | null = null
  let gapMeta: number | null = null
  let gapMetaDesafio: number | null = null

  if (projecaoValida && input.closing.vendasAcumuladas != null) {
    projecaoVendas = input.closing.vendasAcumuladas + vfMes
  }
  if (projecaoValida && input.closing.faturamentoAcumulado != null) {
    // Fat proj = realizado + contratos previstos no mês + novas vendas V+F do mês
    // Não inclui próximo mês; não conta previsão vencida
    projecaoFaturamento = input.closing.faturamentoAcumulado + previstosNoMes + vfMes
  }

  if (input.closing.vendasAcumuladas != null && input.closing.faturamentoAcumulado != null) {
    vnfAtual = input.closing.vendasAcumuladas - input.closing.faturamentoAcumulado
  }

  if (projecaoValida) {
    vnfProjetado = vnfProjetadoCount
    // VNF projetado também pode ser derivado: projVendas - projFat
    // quando há V+F: vendas sobem e fat sobe igual → VNF das novas = 0
    if (projecaoVendas != null && projecaoFaturamento != null) {
      vnfProjetado = Math.max(0, projecaoVendas - projecaoFaturamento)
    }
  }

  if (projecaoFaturamento != null && input.closing.metaMensal != null && input.closing.metaMensal > 0) {
    pctMeta = (projecaoFaturamento / input.closing.metaMensal) * 100
    gapMeta = projecaoFaturamento - input.closing.metaMensal
  }
  if (
    projecaoFaturamento != null &&
    input.closing.metaDesafio != null &&
    input.closing.metaDesafio > 0
  ) {
    pctMetaDesafio = (projecaoFaturamento / input.closing.metaDesafio) * 100
    gapMetaDesafio = projecaoFaturamento - input.closing.metaDesafio
  }
  if (vnfProjetado != null && input.closing.metaMensal != null && input.closing.metaMensal > 0) {
    pctVnfMeta = (vnfProjetado / input.closing.metaMensal) * 100
  }

  return {
    sigla: input.sigla.toUpperCase(),
    contratosAbertos,
    consorcios,
    financiamentosExternos,
    fatHoje,
    fatD1,
    fatD2,
    fatD3,
    fatRestanteMes,
    fatProximoMes,
    totalComPrevisaoMes,
    semPrevisao,
    previsoesDescumpridas,
    metaMensal: input.closing.metaMensal,
    metaDesafio: input.closing.metaDesafio,
    vendasAcumuladas: input.closing.vendasAcumuladas,
    faturamentoAcumulado: input.closing.faturamentoAcumulado,
    conferencia: conf.status,
    conferenciaDelta: conf.delta,
    vfHoje,
    vfFuturoMes,
    projecaoVendas,
    projecaoFaturamento,
    pctMeta,
    pctMetaDesafio,
    vnfAtual,
    vnfProjetado,
    pctVnfMeta,
    gapMeta,
    gapMetaDesafio,
    projecaoValida,
  }
}

export function buildRegionalClosingView(
  stores: StoreClosingView[],
  lojasTotal = RSDSU_SIGLAS.length,
): RegionalClosingView {
  const okStores = stores.filter((s) => s.conferencia === 'OK' && s.projecaoValida)
  const lojasOk = okStores.length
  const parcial = lojasOk < lojasTotal
  const label =
    lojasOk === 0
      ? 'SEM LOJAS CONFERIDAS'
      : parcial
        ? `PARCIAL ${lojasOk}/${lojasTotal} LOJAS`
        : `COMPLETO ${lojasOk}/${lojasTotal} LOJAS`

  const sum = (fn: (s: StoreClosingView) => number) =>
    okStores.reduce((acc, s) => acc + fn(s), 0)

  const metaMensal = sum((s) => s.metaMensal ?? 0)
  const metaDesafio = sum((s) => s.metaDesafio ?? 0)
  const projecaoFaturamento = sum((s) => s.projecaoFaturamento ?? 0)
  const projecaoVendas = sum((s) => s.projecaoVendas ?? 0)
  const vnfProjetado = sum((s) => s.vnfProjetado ?? 0)

  // Percentuais regionais pelos totais — nunca média dos % das lojas
  const pctMeta = metaMensal > 0 ? (projecaoFaturamento / metaMensal) * 100 : null
  const pctMetaDesafio = metaDesafio > 0 ? (projecaoFaturamento / metaDesafio) * 100 : null
  const pctVnfMeta = metaMensal > 0 ? (vnfProjetado / metaMensal) * 100 : null
  const gapMeta = lojasOk > 0 ? projecaoFaturamento - metaMensal : null
  const gapMetaDesafio = lojasOk > 0 ? projecaoFaturamento - metaDesafio : null

  return {
    lojasOk,
    lojasTotal,
    parcial,
    label,
    contratosAbertos: sum((s) => s.contratosAbertos),
    consorcios: sum((s) => s.consorcios),
    financiamentosExternos: sum((s) => s.financiamentosExternos),
    fatHoje: sum((s) => s.fatHoje),
    fatD1: sum((s) => s.fatD1),
    fatD2: sum((s) => s.fatD2),
    fatD3: sum((s) => s.fatD3),
    fatRestanteMes: sum((s) => s.fatRestanteMes),
    fatProximoMes: sum((s) => s.fatProximoMes),
    totalComPrevisaoMes: sum((s) => s.totalComPrevisaoMes),
    semPrevisao: sum((s) => s.semPrevisao),
    previsoesDescumpridas: sum((s) => s.previsoesDescumpridas),
    metaMensal,
    metaDesafio,
    vendasAcumuladas: sum((s) => s.vendasAcumuladas ?? 0),
    faturamentoAcumulado: sum((s) => s.faturamentoAcumulado ?? 0),
    projecaoVendas,
    projecaoFaturamento,
    pctMeta,
    pctMetaDesafio,
    vnfProjetado,
    pctVnfMeta,
    gapMeta,
    gapMetaDesafio,
  }
}

export function enrichContracts(input: {
  contracts: ContractRecord[]
  justifications: Record<string, ContractJustification | undefined>
  brokenIds: Set<string>
  brokenLabel: string
}): EnrichedContract[] {
  return input.contracts.map((c) => {
    const broken = input.brokenIds.has(c.id)
    return {
      ...c,
      justification: input.justifications[c.id] ?? null,
      brokenPromise: broken,
      brokenPromiseLabel: broken ? input.brokenLabel : null,
    }
  })
}

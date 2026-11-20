import type { RsdsuSigla } from './lojas'

/** Registro operacional de um contrato aberto. */
export type ContractRecord = {
  /** Chave estável interna — nunca exibida ao gerente. */
  id: string
  loja: RsdsuSigla | string
  placa: string
  valorConciliado: number | null
  pctPagtoConfirmado: number | null
  diasAbertoPrimeiro: number | null
  diasAbertoAtual: number | null
  /** Primeiro nome do CV/EV. */
  cvEv: string
  codigoContratoAtual: string
  codigoPrimeiroContrato: string
  /** Campos brutos remanescentes (auditoria). */
  raw?: Record<string, string | number | null>
}

export type SimBlank = 'SIM' | ''

export type ContractJustification = {
  contractId: string
  consorcio: SimBlank
  financiamentoExterno: SimBlank
  /** ISO date yyyy-mm-dd ou null. */
  previsaoFat: string | null
  justificativa: string
  updatedAt: string
}

/** Compromisso histórico de previsão (sobrevive à troca de ciclo). */
export type ForecastHistoryEntry = {
  id: string
  contractId: string
  previsaoFat: string
  recordedAt: string
  cycleDate: string
  placa: string
  codigoContratoAtual: string
  codigoPrimeiroContrato: string
}

export type ActiveBaseMeta = {
  importedAt: string
  recordCount: number
  sourceFileName: string
  cycleDate: string
}

export type ActiveBase = {
  meta: ActiveBaseMeta
  contracts: ContractRecord[]
}

export type ImportSuccess = {
  ok: true
  base: ActiveBase
  removedCount: number
  previousCount: number
}

export type ImportFailure = {
  ok: false
  error: string
  preservedBase: ActiveBase | null
}

export type ImportResult = ImportSuccess | ImportFailure

export type ConferenceStatus = 'OK' | 'PENDENTE' | 'DIVERGENCIA'

/** Compromissos V+F por dia (yyyy-mm-dd → quantidade). */
export type VfCommitments = Record<string, number>

export type StoreClosingInput = {
  sigla: string
  metaMensal: number | null
  metaDesafio: number | null
  vendasAcumuladas: number | null
  faturamentoAcumulado: number | null
  vf: VfCommitments
}

export type StoreClosingView = {
  sigla: string
  contratosAbertos: number
  consorcios: number
  financiamentosExternos: number
  fatHoje: number
  fatD1: number
  fatD2: number
  fatD3: number
  fatRestanteMes: number
  fatProximoMes: number
  totalComPrevisaoMes: number
  semPrevisao: number
  previsoesDescumpridas: number
  metaMensal: number | null
  metaDesafio: number | null
  vendasAcumuladas: number | null
  faturamentoAcumulado: number | null
  conferencia: ConferenceStatus
  conferenciaDelta: number | null
  vfHoje: number
  vfFuturoMes: number
  projecaoVendas: number | null
  projecaoFaturamento: number | null
  pctMeta: number | null
  pctMetaDesafio: number | null
  vnfAtual: number | null
  vnfProjetado: number | null
  pctVnfMeta: number | null
  gapMeta: number | null
  gapMetaDesafio: number | null
  projecaoValida: boolean
}

export type RegionalClosingView = {
  lojasOk: number
  lojasTotal: number
  parcial: boolean
  label: string
  contratosAbertos: number
  consorcios: number
  financiamentosExternos: number
  fatHoje: number
  fatD1: number
  fatD2: number
  fatD3: number
  fatRestanteMes: number
  fatProximoMes: number
  totalComPrevisaoMes: number
  semPrevisao: number
  previsoesDescumpridas: number
  metaMensal: number
  metaDesafio: number
  vendasAcumuladas: number
  faturamentoAcumulado: number
  projecaoVendas: number
  projecaoFaturamento: number
  pctMeta: number | null
  pctMetaDesafio: number | null
  vnfProjetado: number
  pctVnfMeta: number | null
  gapMeta: number | null
  gapMetaDesafio: number | null
}

export type EnrichedContract = ContractRecord & {
  justification: ContractJustification | null
  brokenPromise: boolean
  brokenPromiseLabel: string | null
}

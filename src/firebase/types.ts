import type { PainelTabId } from '../painel/tabs/registry'

export type MasterConfig = {
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export type StoreMeta = {
  code: string
  passwordHash: string
  active: boolean
  createdAt: string
  updatedAt: string
  /** Conta Firebase Auth sintética do gestor da loja. */
  authEmail?: string
}

/**
 * Como o indicador aparece na matriz / cálculos:
 * - volume: Meta | Real | Proj%
 * - conversao: cálculo (ex.: Leads / Agendamentos) — sem Meta/Real/Proj clássicos
 * - alvo: Alvo | Real (ex.: NPS) — ou só Real quando unidade = evidência
 */
export type IndicatorKind = 'volume' | 'conversao' | 'alvo'

/**
 * Unidade do tipo Alvo:
 * - percent / absolute: Alvo + Real
 * - evidencia: só Real (sem meta/alvo) — comum em subindicadores
 */
export type AlvoUnidade = 'percent' | 'absolute' | 'evidencia'

export type FormulaOperand = {
  /** Referência a um KPI-mãe ou a um sub. */
  scope: 'kpi' | 'sub'
  kpiId: string
  subId?: string
}

/** Numerador ÷ denominador (ex.: Agendamentos / Leads). */
export type ConversionFormula = {
  op: 'div'
  numerator: FormulaOperand
  denominator: FormulaOperand
}

export type IndicatorChecks = {
  /** Gestor pode lançar planejado (IN). */
  checkIn: boolean
  /** Gestor pode lançar realizado (OUT). */
  checkOut: boolean
}

/** Subindicador dentro do KPI-mãe. */
export type StoreKpiSub = IndicatorChecks & {
  id: string
  nome: string
  kind: IndicatorKind
  /** Só quando kind === 'alvo'. */
  alvoUnidade: AlvoUnidade | null
  formula: ConversionFormula | null
  ordem: number
  ativo: boolean
  createdAt: string
  updatedAt: string
}

/** Indicador isolado por loja: stores/{SIGLA}/kpis/{id} */
export type StoreKpi = IndicatorChecks & {
  id: string
  nome: string
  cor: string
  kind: IndicatorKind
  /** Só quando kind === 'alvo'. */
  alvoUnidade: AlvoUnidade | null
  formula: ConversionFormula | null
  ordem: number
  ativo: boolean
  createdAt: string
  updatedAt: string
  /** Carregado sob demanda / no subscribe enriquecido. */
  subs?: StoreKpiSub[]
}

/** Meta/alvo do mês — path stores/{SIGLA}/metas/{yyyy-MM}/... */
export type MonthMetaEntry = {
  valor: number
  updatedAt: string
  updatedBy: 'painel'
}

export type TimeWindow = {
  start: string
  end: string
}

/**
 * Janelas de check + dias ativos da loja.
 * Path: stores/{SIGLA}/config/checkSchedule
 */
export type CheckScheduleConfig = {
  checkIn: TimeWindow
  checkOut: TimeWindow
  /** Chaves "0".."6" (Dom..Sáb). true = dia ativo. */
  weekdays: Record<string, boolean>
  timezone: string
  updatedAt: string
}

export type CheckEntryTipo = 'checkIn' | 'checkOut'

export type ManagerCheckEntry = {
  valor: number
  updatedAt: string
  updatedBy: 'gestor' | 'painel'
  texto?: string
}

/** Persistência da organização das abas na raiz. */
export type PainelTabsConfig = {
  order: PainelTabId[]
  enabled: Partial<Record<PainelTabId, boolean>>
  /** Classificação livre por aba (ex.: operação, config). */
  groups: Partial<Record<PainelTabId, string>>
  updatedAt: string
}

export const INDICATOR_KIND_LABELS: Record<IndicatorKind, string> = {
  volume: 'Volume (Meta · Real · Proj%)',
  conversao: 'Conversão (cálculo A ÷ B)',
  alvo: 'Alvo (Alvo · Real)',
}

export const ALVO_UNIDADE_LABELS: Record<AlvoUnidade, string> = {
  percent: 'Percentual (%)',
  absolute: 'Número absoluto',
  evidencia: 'Só evidenciar (só Real)',
}

export const INDICATOR_KIND_SHORT: Record<IndicatorKind, string> = {
  volume: 'Volume',
  conversao: 'Conversão',
  alvo: 'Alvo',
}

export function matrixColumnsForKind(
  kind: IndicatorKind,
  alvoUnidade?: AlvoUnidade | null,
): string[] {
  switch (kind) {
    case 'conversao':
      return ['Conversão']
    case 'alvo':
      return alvoUnidade === 'evidencia' ? ['Real'] : ['Alvo', 'Real']
    default:
      return ['Meta', 'Real', 'Proj%']
  }
}

/** Defaults de IN/OUT ao trocar o tipo (pode sobrescrever depois). */
export function defaultChecksForKind(kind: IndicatorKind): IndicatorChecks {
  switch (kind) {
    case 'conversao':
      return { checkIn: false, checkOut: false }
    case 'alvo':
      return { checkIn: false, checkOut: true }
    default:
      return { checkIn: true, checkOut: true }
  }
}

export function needsMonthMeta(kind: IndicatorKind): boolean {
  return kind === 'volume' || kind === 'alvo'
}

/** Meta/Alvo mensal — falso para Alvo em modo só evidenciar. */
export function needsMonthMetaFor(indicator: {
  kind: IndicatorKind
  alvoUnidade?: AlvoUnidade | null
}): boolean {
  if (indicator.kind === 'volume') return true
  if (indicator.kind === 'alvo') return indicator.alvoUnidade !== 'evidencia'
  return false
}

export function metaFieldLabel(kind: IndicatorKind): string {
  return kind === 'alvo' ? 'Alvo' : 'Meta'
}

export function alvoUnidadeShort(unidade: AlvoUnidade | null | undefined): string {
  if (unidade === 'absolute') return 'nº'
  if (unidade === 'evidencia') return 'evid.'
  if (unidade === 'percent') return '%'
  return ''
}

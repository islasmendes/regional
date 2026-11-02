import { onValue, ref, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { APP_TIMEZONE, getZonedNow } from '../lib/time'
import { database } from './config'
import { storeManagerChecksPath, storeMetasMonthPath, storeResultsPath } from './paths'
import type {
  ConversionFormula,
  IndicatorKind,
  MonthMetaEntry,
  StoreKpi,
  StoreKpiSub,
} from './types'

export type MatrixMetaTree = Record<
  string,
  Partial<MonthMetaEntry> & { subs?: Record<string, Partial<MonthMetaEntry>> }
>

/** Totais OUT (e IN) do mês por KPI / sub. */
export type MonthCheckTotals = Record<
  string,
  {
    checkIn: number
    checkOut: number
    daysOut: number
    subs?: Record<string, { checkIn: number; checkOut: number; daysOut: number }>
  }
>

export type MonthResultOverride = Record<
  string,
  { valor?: number; updatedAt?: string; updatedBy?: string; subs?: Record<string, { valor?: number }> }
>

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

export function subscribeMonthMetasTree(
  siglaInput: string,
  monthKey: string,
  callback: (tree: MatrixMetaTree) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, storeMetasMonthPath(sigla, monthKey)), (snap) => {
    callback(snap.exists() ? (snap.val() as MatrixMetaTree) : {})
  })
}

export function subscribeMonthResults(
  siglaInput: string,
  monthKey: string,
  callback: (tree: MonthResultOverride) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, storeResultsPath(sigla, monthKey)), (snap) => {
    callback(snap.exists() ? (snap.val() as MonthResultOverride) : {})
  })
}

function emptyTotals() {
  return { checkIn: 0, checkOut: 0, daysOut: 0 }
}

/** Soma check-in/out do mês a partir de managerChecks/{mês}/entries. */
export function subscribeMonthCheckTotals(
  siglaInput: string,
  monthKey: string,
  callback: (totals: MonthCheckTotals) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, storeManagerChecksPath(sigla, monthKey)), (snap) => {
    if (!snap.exists()) {
      callback({})
      return
    }
    const tree = snap.val() as Record<string, Record<string, unknown>>
    const totals: MonthCheckTotals = {}

    for (const [kpiId, node] of Object.entries(tree)) {
      if (!node || typeof node !== 'object') continue
      const bucket = emptyTotals()
      const subs: NonNullable<MonthCheckTotals[string]['subs']> = {}

      for (const [key, value] of Object.entries(node)) {
        if (key === 'subs') {
          const subsNode = value as Record<string, Record<string, { checkIn?: { valor?: number }; checkOut?: { valor?: number } }>>
          for (const [subId, days] of Object.entries(subsNode ?? {})) {
            const subBucket = emptyTotals()
            for (const dayVal of Object.values(days ?? {})) {
              if (typeof dayVal?.checkIn?.valor === 'number') {
                subBucket.checkIn += dayVal.checkIn.valor
              }
              if (typeof dayVal?.checkOut?.valor === 'number') {
                subBucket.checkOut += dayVal.checkOut.valor
                subBucket.daysOut += 1
              }
            }
            subs[subId] = subBucket
          }
          continue
        }
        // dayKey
        const dayVal = value as { checkIn?: { valor?: number }; checkOut?: { valor?: number } }
        if (typeof dayVal?.checkIn?.valor === 'number') bucket.checkIn += dayVal.checkIn.valor
        if (typeof dayVal?.checkOut?.valor === 'number') {
          bucket.checkOut += dayVal.checkOut.valor
          bucket.daysOut += 1
        }
      }

      totals[kpiId] = {
        ...bucket,
        ...(Object.keys(subs).length > 0 ? { subs } : {}),
      }
    }

    callback(totals)
  })
}

export type MatrixCellView = {
  kind: IndicatorKind
  meta: number | null
  real: number | null
  projPct: number | null
  conversaoPct: number | null
  source: 'checkout' | 'override' | 'formula' | 'empty'
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return 30
  return new Date(y, m, 0).getDate()
}

export function monthPace(monthKey: string, timeZone = APP_TIMEZONE, at = new Date()) {
  const zoned = getZonedNow(timeZone, at)
  const inMonth = zoned.monthKey === monthKey
  const total = daysInMonth(monthKey)
  const elapsed = inMonth ? Math.max(1, zoned.day) : total
  return { daysInMonth: total, daysElapsed: elapsed }
}

/** Ex.: "dia 2/30" — ritmo usado na Proj%. */
export function formatMonthPaceLabel(monthKey: string, timeZone = APP_TIMEZONE): string {
  const { daysInMonth: total, daysElapsed } = monthPace(monthKey, timeZone)
  return `dia ${daysElapsed}/${total}`
}

function projPct(meta: number | null, real: number | null, monthKey: string): number | null {
  if (meta == null || meta <= 0 || real == null) return null
  const { daysInMonth: dim, daysElapsed } = monthPace(monthKey)
  const projected = (real / daysElapsed) * dim
  return (projected / meta) * 100
}

/**
 * Proj% = (Real ÷ dias decorridos × dias do mês) ÷ Meta × 100
 * Extrapolação linear do ritmo atual até o fim do mês.
 */
export function describeProjPct(
  meta: number | null,
  real: number | null,
  monthKey: string,
): string | null {
  if (meta == null || meta <= 0 || real == null || !Number.isFinite(real)) return null
  const { daysInMonth: dim, daysElapsed } = monthPace(monthKey)
  const projected = (real / daysElapsed) * dim
  const pct = (projected / meta) * 100
  const projectedLabel = projected.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const pctLabel = pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `Proj% = (Real ÷ ${daysElapsed}d × ${dim}d) ÷ Meta × 100 → (${real} ÷ ${daysElapsed} × ${dim}) ÷ ${meta} = ${projectedLabel} ÷ ${meta} = ${pctLabel}%`
}

function resolveOperandReal(
  formula: ConversionFormula,
  side: 'numerator' | 'denominator',
  checks: MonthCheckTotals,
  overrides: MonthResultOverride,
): number | null {
  const op = formula[side]
  if (op.scope === 'sub' && op.subId) {
    const override = asFiniteNumber(overrides[op.kpiId]?.subs?.[op.subId]?.valor)
    if (override != null) return override
    return asFiniteNumber(checks[op.kpiId]?.subs?.[op.subId]?.checkOut)
  }
  const override = asFiniteNumber(overrides[op.kpiId]?.valor)
  if (override != null) return override
  return asFiniteNumber(checks[op.kpiId]?.checkOut)
}

export function buildMatrixCell(params: {
  kind: IndicatorKind
  formula: ConversionFormula | null
  monthKey: string
  metaValor: number | undefined
  checkOut: number | undefined
  overrideValor: number | undefined
  checks: MonthCheckTotals
  overrides: MonthResultOverride
}): MatrixCellView {
  const { kind, formula, monthKey, metaValor, checkOut, overrideValor, checks, overrides } = params

  if (kind === 'conversao') {
    if (!formula) {
      return {
        kind,
        meta: null,
        real: null,
        projPct: null,
        conversaoPct: null,
        source: 'empty',
      }
    }
    const num = resolveOperandReal(formula, 'numerator', checks, overrides)
    const den = resolveOperandReal(formula, 'denominator', checks, overrides)
    const conversaoPct =
      num != null && den != null && den !== 0 ? (num / den) * 100 : null
    return {
      kind,
      meta: null,
      real: null,
      projPct: null,
      conversaoPct,
      source: conversaoPct == null ? 'empty' : 'formula',
    }
  }

  const meta = asFiniteNumber(metaValor)
  const override = asFiniteNumber(overrideValor)
  const checkout = asFiniteNumber(checkOut)
  const hasOverride = override != null
  const real = hasOverride ? override : checkout

  return {
    kind,
    meta,
    real,
    projPct: kind === 'volume' ? projPct(meta, real, monthKey) : null,
    conversaoPct: null,
    source: real == null ? 'empty' : hasOverride ? 'override' : 'checkout',
  }
}

export function cellForKpi(params: {
  kpi: StoreKpi
  monthKey: string
  metas: MatrixMetaTree
  checks: MonthCheckTotals
  overrides: MonthResultOverride
}): MatrixCellView {
  return buildMatrixCell({
    kind: params.kpi.kind,
    formula: params.kpi.formula,
    monthKey: params.monthKey,
    metaValor: params.metas[params.kpi.id]?.valor,
    checkOut: params.checks[params.kpi.id]?.checkOut,
    overrideValor: params.overrides[params.kpi.id]?.valor,
    checks: params.checks,
    overrides: params.overrides,
  })
}

export function cellForSub(params: {
  parent: StoreKpi
  sub: StoreKpiSub
  monthKey: string
  metas: MatrixMetaTree
  checks: MonthCheckTotals
  overrides: MonthResultOverride
}): MatrixCellView {
  return buildMatrixCell({
    kind: params.sub.kind,
    formula: params.sub.formula,
    monthKey: params.monthKey,
    metaValor: params.metas[params.parent.id]?.subs?.[params.sub.id]?.valor,
    checkOut: params.checks[params.parent.id]?.subs?.[params.sub.id]?.checkOut,
    overrideValor: params.overrides[params.parent.id]?.subs?.[params.sub.id]?.valor,
    checks: params.checks,
    overrides: params.overrides,
  })
}

export function formatMatrixNumber(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** Semáforo familiar: vermelho / amarelo / verde. */
export type ProjTone = 'bad' | 'warn' | 'good' | 'empty'

export function projTone(value: number | null): ProjTone {
  if (value == null || !Number.isFinite(value)) return 'empty'
  if (value < 85) return 'bad'
  if (value < 100) return 'warn'
  return 'good'
}

export function recentMonthKeys(count = 6, timeZone = APP_TIMEZONE): string[] {
  const now = getZonedNow(timeZone)
  const keys: string[] = []
  let y = now.year
  let m = now.month
  for (let i = 0; i < count; i += 1) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return keys
}

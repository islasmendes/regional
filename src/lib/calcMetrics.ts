/** Utilitários de métricas — crescimento relativo ≠ variação em pontos percentuais. */

export type CalcNumber = number | null

export function parseLocaleNumber(raw: string): CalcNumber {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function formatSigned(value: number, digits = 2, suffix = ''): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}${suffix}`
}

export function formatPlain(value: number, digits = 2, suffix = ''): string {
  return `${value.toFixed(digits)}${suffix}`
}

/** Variação em pontos percentuais: diferença absoluta entre duas taxas. */
export function pontosPercentuais(atual: number, base: number): number {
  return atual - base
}

/**
 * Crescimento / variação relativa (%): quanto o valor mudou em relação à base.
 * Ex.: de 50% para 55% → +10% de crescimento (não +5 p.p.).
 */
export function crescimentoRelativo(atual: number, base: number): number | null {
  if (base === 0) return null
  return ((atual - base) / Math.abs(base)) * 100
}

/** Atingimento da meta: Real ÷ Meta × 100. */
export function atingimento(real: number, meta: number): number | null {
  if (meta === 0) return null
  return (real / meta) * 100
}

/** Gap absoluto (mesmo sinal da subtração atual − referência). */
export function gapAbsoluto(atual: number, referencia: number): number {
  return atual - referencia
}

/** Projeção linear no mês: real / (diasDecorridos/diasMes) → equivalente 100%. */
export function projecaoPercentual(
  real: number,
  meta: number,
  diasDecorridos: number,
  diasMes: number,
): number | null {
  if (meta === 0 || diasDecorridos <= 0 || diasMes <= 0) return null
  const ritmo = real / (diasDecorridos / diasMes)
  return (ritmo / meta) * 100
}

/** Quanto falta por dia para bater a meta no restante do mês. */
export function ritmoNecessarioDiario(
  real: number,
  meta: number,
  diasRestantes: number,
): number | null {
  if (diasRestantes <= 0) return null
  return (meta - real) / diasRestantes
}

/** Conversão simples A ÷ B × 100 (ou índice se não for %). */
export function conversao(numerador: number, denominador: number): number | null {
  if (denominador === 0) return null
  return (numerador / denominador) * 100
}

/** Participação / share: parte ÷ todo × 100. */
export function participacao(parte: number, todo: number): number | null {
  if (todo === 0) return null
  return (parte / todo) * 100
}

/** CAGR composto entre n períodos. */
export function cagr(inicial: number, final: number, periodos: number): number | null {
  if (inicial <= 0 || final <= 0 || periodos <= 0) return null
  return (Math.pow(final / inicial, 1 / periodos) - 1) * 100
}

/** Meta necessária para um atingimento desejado dado o real. */
export function metaParaAtingimento(real: number, atingimentoDesejadoPct: number): number | null {
  if (atingimentoDesejadoPct === 0) return null
  return real / (atingimentoDesejadoPct / 100)
}

/** Real necessário para um atingimento desejado dada a meta. */
export function realParaAtingimento(meta: number, atingimentoDesejadoPct: number): number {
  return meta * (atingimentoDesejadoPct / 100)
}

export type ResultTone = 'positive' | 'negative' | 'neutral' | 'warn'

export type CalcResult = {
  id: string
  label: string
  value: string
  hint?: string
  tone?: ResultTone
}

export function toneFromSigned(value: number | null, invert = false): ResultTone {
  if (value === null || value === 0) return 'neutral'
  const positive = invert ? value < 0 : value > 0
  return positive ? 'positive' : 'negative'
}

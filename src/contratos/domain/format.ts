/** Formatação BR para valores monetários e percentuais. */

export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Percentual 0–1 ou 0–100 → exibição 0–100%. */
export function formatPct(
  value: number | null | undefined,
  opts?: { alreadyPercent?: boolean },
): string {
  if (value == null || Number.isNaN(value)) return '—'
  const pct = opts?.alreadyPercent ? value : value * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR')
}

export function attainmentTone(pct: number | null | undefined): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (pct == null || Number.isNaN(pct)) return 'neutral'
  if (pct >= 100) return 'ok'
  if (pct >= 85) return 'warn'
  return 'bad'
}

export function gapTone(gap: number | null | undefined): 'ok' | 'bad' | 'neutral' {
  if (gap == null || Number.isNaN(gap)) return 'neutral'
  return gap >= 0 ? 'ok' : 'bad'
}

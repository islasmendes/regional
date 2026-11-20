/** Helpers de data no fuso operacional (calendário civil yyyy-mm-dd). */

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

export function formatBrDate(value: string | null | undefined): string {
  const dt = parseIsoDate(value)
  if (!dt) return ''
  const d = String(dt.getDate()).padStart(2, '0')
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${dt.getFullYear()}`
}

export function addDays(iso: string, days: number): string {
  const dt = parseIsoDate(iso)
  if (!dt) return iso
  dt.setDate(dt.getDate() + days)
  return toIsoDate(dt)
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function endOfMonth(iso: string): string {
  const dt = parseIsoDate(iso)
  if (!dt) return iso
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0)
  return toIsoDate(last)
}

export function startOfNextMonth(iso: string): string {
  const dt = parseIsoDate(iso)
  if (!dt) return iso
  const next = new Date(dt.getFullYear(), dt.getMonth() + 1, 1)
  return toIsoDate(next)
}

export function isSameOrBefore(a: string, b: string): boolean {
  return a <= b
}

export function isAfter(a: string, b: string): boolean {
  return a > b
}

/** Dias do mês a partir de `fromIso` inclusive até o fim do mês. */
export function remainingDaysInMonth(fromIso: string): string[] {
  const end = endOfMonth(fromIso)
  const days: string[] = []
  let cur = fromIso
  while (cur <= end) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

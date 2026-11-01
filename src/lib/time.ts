/** Fuso padrão do produto (gestor no Brasil). */
export const APP_TIMEZONE = 'America/Sao_Paulo'

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_LABELS: { id: WeekdayIndex; short: string; full: string }[] = [
  { id: 0, short: 'Dom', full: 'Domingo' },
  { id: 1, short: 'Seg', full: 'Segunda' },
  { id: 2, short: 'Ter', full: 'Terça' },
  { id: 3, short: 'Qua', full: 'Quarta' },
  { id: 4, short: 'Qui', full: 'Quinta' },
  { id: 5, short: 'Sex', full: 'Sexta' },
  { id: 6, short: 'Sáb', full: 'Sábado' },
]

export type ZonedNow = {
  date: Date
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: WeekdayIndex
  dayKey: string
  monthKey: string
  minutesOfDay: number
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

const weekdayMap: Record<string, WeekdayIndex> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function getZonedNow(timeZone = APP_TIMEZONE, at = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)

  const year = Number(part(parts, 'year'))
  const month = Number(part(parts, 'month'))
  const day = Number(part(parts, 'day'))
  const hour = Number(part(parts, 'hour'))
  const minute = Number(part(parts, 'minute'))
  const weekday = weekdayMap[part(parts, 'weekday')] ?? 0
  const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  return {
    date: at,
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    dayKey,
    monthKey,
    minutesOfDay: hour * 60 + minute,
  }
}

/** "08:30" ou "08:30:00" → minutos desde 00:00 */
export function parseHhMm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null
  return h * 60 + m
}

export function formatHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidHhMm(value: string): boolean {
  return parseHhMm(value) != null
}

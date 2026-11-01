import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database'
import {
  APP_TIMEZONE,
  formatHhMm,
  getZonedNow,
  parseHhMm,
  type WeekdayIndex,
} from '../lib/time'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeConfigPath } from './paths'
import type { CheckScheduleConfig, TimeWindow } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

export function defaultCheckSchedule(): CheckScheduleConfig {
  const weekdays: Record<string, boolean> = {}
  for (let d = 0; d <= 6; d += 1) {
    // Dom off; Seg–Sáb on
    weekdays[String(d)] = d !== 0
  }
  return {
    checkIn: { start: '08:00', end: '12:00' },
    checkOut: { start: '14:00', end: '20:00' },
    weekdays,
    timezone: APP_TIMEZONE,
    updatedAt: nowIso(),
  }
}

function normalizeWindow(raw: Partial<TimeWindow> | undefined, fallback: TimeWindow): TimeWindow {
  const startMins = raw?.start ? parseHhMm(raw.start) : null
  const endMins = raw?.end ? parseHhMm(raw.end) : null
  return {
    start: startMins != null ? formatHhMm(startMins) : fallback.start,
    end: endMins != null ? formatHhMm(endMins) : fallback.end,
  }
}

export function normalizeCheckSchedule(raw: unknown): CheckScheduleConfig {
  const fallback = defaultCheckSchedule()
  if (!raw || typeof raw !== 'object') return fallback
  const value = raw as Partial<CheckScheduleConfig>
  const weekdays: Record<string, boolean> = { ...fallback.weekdays }
  if (value.weekdays && typeof value.weekdays === 'object') {
    for (let d = 0; d <= 6; d += 1) {
      const key = String(d)
      if (typeof value.weekdays[key] === 'boolean') weekdays[key] = value.weekdays[key]!
    }
  }
  return {
    checkIn: normalizeWindow(value.checkIn, fallback.checkIn),
    checkOut: normalizeWindow(value.checkOut, fallback.checkOut),
    weekdays,
    timezone: value.timezone?.trim() || APP_TIMEZONE,
    updatedAt: value.updatedAt ?? nowIso(),
  }
}

export function checkSchedulePath(sigla: string): string {
  return storeConfigPath(sigla, 'checkSchedule')
}

export async function readCheckSchedule(siglaInput: string): Promise<CheckScheduleConfig> {
  const sigla = assertLojaSigla(siglaInput)
  const snap = await get(ref(database, checkSchedulePath(sigla)))
  if (!snap.exists()) return defaultCheckSchedule()
  return normalizeCheckSchedule(snap.val())
}

export function subscribeCheckSchedule(
  siglaInput: string,
  callback: (config: CheckScheduleConfig) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, checkSchedulePath(sigla)), (snap) => {
    callback(snap.exists() ? normalizeCheckSchedule(snap.val()) : defaultCheckSchedule())
  })
}

export async function saveCheckSchedule(
  siglaInput: string,
  config: CheckScheduleConfig,
): Promise<CheckScheduleConfig> {
  const sigla = assertLojaSigla(siglaInput)
  const normalized = normalizeCheckSchedule(config)

  const inStart = parseHhMm(normalized.checkIn.start)
  const inEnd = parseHhMm(normalized.checkIn.end)
  const outStart = parseHhMm(normalized.checkOut.start)
  const outEnd = parseHhMm(normalized.checkOut.end)
  if (inStart == null || inEnd == null || outStart == null || outEnd == null) {
    throw new Error('Horários inválidos. Use o formato HH:MM.')
  }
  if (inStart >= inEnd) throw new Error('Check-in: início deve ser antes do fim.')
  if (outStart >= outEnd) throw new Error('Check-out: início deve ser antes do fim.')

  const payload: CheckScheduleConfig = { ...normalized, updatedAt: nowIso() }
  await set(ref(database, checkSchedulePath(sigla)), payload)
  return payload
}

export type WindowStatus = {
  dayEnabled: boolean
  withinWindow: boolean
  open: boolean
  label: string
}

export function evaluateWindow(
  schedule: CheckScheduleConfig,
  tipo: 'checkIn' | 'checkOut',
  at = new Date(),
): WindowStatus {
  const zoned = getZonedNow(schedule.timezone || APP_TIMEZONE, at)
  const dayEnabled = schedule.weekdays[String(zoned.weekday)] === true
  const window = tipo === 'checkIn' ? schedule.checkIn : schedule.checkOut
  const start = parseHhMm(window.start) ?? 0
  const end = parseHhMm(window.end) ?? 0
  const withinWindow = zoned.minutesOfDay >= start && zoned.minutesOfDay <= end
  const open = dayEnabled && withinWindow
  const label = dayEnabled
    ? withinWindow
      ? `Aberto · ${window.start}–${window.end}`
      : `Fechado agora · janela ${window.start}–${window.end}`
    : 'Dia desativado na agenda'
  return { dayEnabled, withinWindow, open, label }
}

export function isWeekdayEnabled(schedule: CheckScheduleConfig, weekday: WeekdayIndex): boolean {
  return schedule.weekdays[String(weekday)] === true
}

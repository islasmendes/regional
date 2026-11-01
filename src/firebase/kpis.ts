import { get, onValue, ref, remove, set, update, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import { storeKpiPath, storeKpisPath } from './paths'
import type { StoreKpi } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function newKpiId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8)
  }
  return `k${Date.now().toString(36)}`
}

const DEFAULT_COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e']

export function defaultKpiColor(index = 0): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]!
}

function mapKpi(id: string, raw: Partial<StoreKpi>): StoreKpi | null {
  if (!raw?.nome?.trim()) return null
  return {
    id,
    nome: raw.nome.trim(),
    cor: raw.cor?.trim() || defaultKpiColor(0),
    checkIn: raw.checkIn !== false,
    checkOut: raw.checkOut !== false,
    ordem: Number.isFinite(raw.ordem) ? Number(raw.ordem) : 0,
    ativo: raw.ativo !== false,
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
  }
}

export function sortKpis(kpis: StoreKpi[]): StoreKpi[] {
  return [...kpis].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function listStoreKpis(siglaInput: string): Promise<StoreKpi[]> {
  const sigla = assertLojaSigla(siglaInput)
  const snap = await get(ref(database, storeKpisPath(sigla)))
  if (!snap.exists()) return []
  const tree = snap.val() as Record<string, Partial<StoreKpi>>
  return sortKpis(
    Object.entries(tree)
      .map(([id, raw]) => mapKpi(id, raw))
      .filter((item): item is StoreKpi => item != null),
  )
}

export function subscribeStoreKpis(
  siglaInput: string,
  callback: (kpis: StoreKpi[]) => void,
): Unsubscribe {
  const sigla = assertLojaSigla(siglaInput)
  return onValue(ref(database, storeKpisPath(sigla)), (snap) => {
    if (!snap.exists()) {
      callback([])
      return
    }
    const tree = snap.val() as Record<string, Partial<StoreKpi>>
    callback(
      sortKpis(
        Object.entries(tree)
          .map(([id, raw]) => mapKpi(id, raw))
          .filter((item): item is StoreKpi => item != null),
      ),
    )
  })
}

export type StoreKpiInput = {
  nome: string
  cor?: string
  checkIn?: boolean
  checkOut?: boolean
  ativo?: boolean
}

export async function createStoreKpi(siglaInput: string, input: StoreKpiInput): Promise<StoreKpi> {
  const sigla = assertLojaSigla(siglaInput)
  const nome = input.nome.trim()
  if (nome.length < 2) throw new Error('Nome do KPI deve ter pelo menos 2 caracteres.')
  const checkIn = input.checkIn ?? true
  const checkOut = input.checkOut ?? true
  if (!checkIn && !checkOut) {
    throw new Error('Marque pelo menos check-in ou check-out.')
  }

  const existing = await listStoreKpis(sigla)
  const id = newKpiId()
  const kpi: StoreKpi = {
    id,
    nome,
    cor: input.cor?.trim() || defaultKpiColor(existing.length),
    checkIn,
    checkOut,
    ordem: existing.length === 0 ? 0 : Math.max(...existing.map((k) => k.ordem)) + 1,
    ativo: input.ativo !== false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await set(ref(database, storeKpiPath(sigla, id)), kpi)
  return kpi
}

export async function updateStoreKpi(
  siglaInput: string,
  kpiId: string,
  input: StoreKpiInput & { ordem?: number; ativo?: boolean },
): Promise<StoreKpi> {
  const sigla = assertLojaSigla(siglaInput)
  const path = storeKpiPath(sigla, kpiId)
  const snap = await get(ref(database, path))
  if (!snap.exists()) throw new Error('KPI não encontrado.')
  const current = mapKpi(kpiId, snap.val() as Partial<StoreKpi>)
  if (!current) throw new Error('KPI inválido na nuvem.')

  const nome = input.nome.trim()
  if (nome.length < 2) throw new Error('Nome do KPI deve ter pelo menos 2 caracteres.')
  const checkIn = input.checkIn ?? current.checkIn
  const checkOut = input.checkOut ?? current.checkOut
  if (!checkIn && !checkOut) throw new Error('Marque pelo menos check-in ou check-out.')

  const next: StoreKpi = {
    ...current,
    nome,
    cor: input.cor?.trim() || current.cor,
    checkIn,
    checkOut,
    ordem: input.ordem ?? current.ordem,
    ativo: input.ativo ?? current.ativo,
    updatedAt: nowIso(),
  }
  await set(ref(database, path), next)
  return next
}

export async function deleteStoreKpi(siglaInput: string, kpiId: string): Promise<void> {
  const sigla = assertLojaSigla(siglaInput)
  await remove(ref(database, storeKpiPath(sigla, kpiId)))
}

export async function moveStoreKpi(
  siglaInput: string,
  kpiId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const sigla = assertLojaSigla(siglaInput)
  const list = await listStoreKpis(sigla)
  const index = list.findIndex((k) => k.id === kpiId)
  if (index < 0) throw new Error('KPI não encontrado.')
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= list.length) return

  const a = list[index]!
  const b = list[target]!
  await update(ref(database), {
    [`${storeKpiPath(sigla, a.id)}/ordem`]: b.ordem,
    [`${storeKpiPath(sigla, a.id)}/updatedAt`]: nowIso(),
    [`${storeKpiPath(sigla, b.id)}/ordem`]: a.ordem,
    [`${storeKpiPath(sigla, b.id)}/updatedAt`]: nowIso(),
  })
}

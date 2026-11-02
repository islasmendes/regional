import { get, onValue, ref, remove, set, update, type Unsubscribe } from 'firebase/database'
import { assertLojaSigla } from '../lib/sigla'
import { database } from './config'
import {
  storeKpiPath,
  storeKpiSubPath,
  storeKpiSubsPath,
  storeKpisPath,
} from './paths'
import type {
  AlvoUnidade,
  ConversionFormula,
  IndicatorKind,
  StoreKpi,
  StoreKpiSub,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}${Date.now().toString(36)}`
}

/** Id compartilhado ao gravar o mesmo KPI/sub em várias lojas (TODOS). */
export function allocateEntityId(prefix: 'k' | 's' = 'k'): string {
  return newId(prefix)
}

const DEFAULT_COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e']

export function defaultKpiColor(index = 0): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]!
}

function normalizeKind(raw: unknown): IndicatorKind {
  if (raw === 'conversao' || raw === 'alvo' || raw === 'volume') return raw
  return 'volume'
}

function normalizeAlvoUnidade(kind: IndicatorKind, raw: unknown): AlvoUnidade | null {
  if (kind !== 'alvo') return null
  if (raw === 'percent' || raw === 'absolute' || raw === 'evidencia') return raw
  return 'percent'
}

function normalizeFormula(raw: unknown): ConversionFormula | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<ConversionFormula>
  const num = value.numerator
  const den = value.denominator
  if (!num?.kpiId || !den?.kpiId) return null
  if (num.scope !== 'kpi' && num.scope !== 'sub') return null
  if (den.scope !== 'kpi' && den.scope !== 'sub') return null
  if (num.scope === 'sub' && !num.subId) return null
  if (den.scope === 'sub' && !den.subId) return null
  return {
    op: 'div',
    numerator: {
      scope: num.scope,
      kpiId: num.kpiId,
      ...(num.scope === 'sub' ? { subId: num.subId } : {}),
    },
    denominator: {
      scope: den.scope,
      kpiId: den.kpiId,
      ...(den.scope === 'sub' ? { subId: den.subId } : {}),
    },
  }
}

/** Check-in/out são opcionais — Volume pode ter só Meta/Real manual na Matriz. */
function validateChecks(_kind: IndicatorKind, _checkIn: boolean, _checkOut: boolean): void {
  // sem bloqueio: flags só controlam presença no checkout do gestor
}

function validateFormula(kind: IndicatorKind, formula: ConversionFormula | null): void {
  if (kind === 'conversao' && !formula) {
    throw new Error('Conversão: selecione numerador e denominador (ex.: Agendamentos ÷ Leads).')
  }
}

export function mapSub(id: string, raw: Partial<StoreKpiSub>): StoreKpiSub | null {
  if (!raw?.nome?.trim()) return null
  const kind = normalizeKind(raw.kind)
  return {
    id,
    nome: raw.nome.trim(),
    kind,
    alvoUnidade: normalizeAlvoUnidade(kind, raw.alvoUnidade),
    checkIn: !!raw.checkIn,
    checkOut: !!raw.checkOut,
    formula: normalizeFormula(raw.formula),
    ordem: Number.isFinite(raw.ordem) ? Number(raw.ordem) : 0,
    ativo: raw.ativo !== false,
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
  }
}

export function mapKpi(
  id: string,
  raw: Omit<Partial<StoreKpi>, 'subs'> & { subs?: unknown },
): StoreKpi | null {
  if (!raw?.nome?.trim()) return null
  const kind = normalizeKind(raw.kind)
  const subsRaw = raw.subs
  let subs: StoreKpiSub[] | undefined
  if (subsRaw && typeof subsRaw === 'object' && !Array.isArray(subsRaw)) {
    subs = Object.entries(subsRaw as Record<string, Partial<StoreKpiSub>>)
      .map(([subId, value]) => mapSub(subId, value))
      .filter((item): item is StoreKpiSub => item != null)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  }
  return {
    id,
    nome: raw.nome.trim(),
    cor: raw.cor?.trim() || defaultKpiColor(0),
    kind,
    alvoUnidade: normalizeAlvoUnidade(kind, raw.alvoUnidade),
    checkIn: !!raw.checkIn,
    checkOut: !!raw.checkOut,
    formula: normalizeFormula(raw.formula),
    ordem: Number.isFinite(raw.ordem) ? Number(raw.ordem) : 0,
    ativo: raw.ativo !== false,
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
    ...(subs ? { subs } : {}),
  }
}

export function sortKpis(kpis: StoreKpi[]): StoreKpi[] {
  return [...kpis].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
}

function treeToKpis(tree: Record<string, Partial<StoreKpi>>): StoreKpi[] {
  return sortKpis(
    Object.entries(tree)
      .map(([id, raw]) => mapKpi(id, raw))
      .filter((item): item is StoreKpi => item != null),
  )
}

export async function listStoreKpis(siglaInput: string): Promise<StoreKpi[]> {
  const sigla = assertLojaSigla(siglaInput)
  const snap = await get(ref(database, storeKpisPath(sigla)))
  if (!snap.exists()) return []
  return treeToKpis(snap.val() as Record<string, Partial<StoreKpi>>)
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
    callback(treeToKpis(snap.val() as Record<string, Partial<StoreKpi>>))
  })
}

export type StoreKpiInput = {
  nome: string
  cor?: string
  kind?: IndicatorKind
  alvoUnidade?: AlvoUnidade | null
  checkIn?: boolean
  checkOut?: boolean
  formula?: ConversionFormula | null
  ativo?: boolean
}

function buildKpiPayload(
  id: string,
  input: StoreKpiInput,
  current: StoreKpi | null,
  ordem: number,
): StoreKpi {
  const kind = input.kind ?? current?.kind ?? 'volume'
  const checkIn = input.checkIn ?? current?.checkIn ?? kind === 'volume'
  const checkOut = input.checkOut ?? current?.checkOut ?? kind === 'volume'
  const formula =
    input.formula !== undefined ? input.formula : (current?.formula ?? null)
  const alvoUnidade =
    kind === 'alvo'
      ? normalizeAlvoUnidade(
          kind,
          input.alvoUnidade !== undefined ? input.alvoUnidade : current?.alvoUnidade,
        )
      : null
  if (kind === 'alvo' && !alvoUnidade) {
    throw new Error('Alvo: selecione a unidade (%, absoluto ou só evidenciar).')
  }
  validateChecks(kind, checkIn, checkOut)
  validateFormula(kind, kind === 'conversao' ? formula : null)

  return {
    id,
    nome: input.nome.trim(),
    cor: input.cor?.trim() || current?.cor || defaultKpiColor(0),
    kind,
    alvoUnidade,
    checkIn,
    checkOut,
    formula: kind === 'conversao' ? formula : null,
    ordem,
    ativo: input.ativo ?? current?.ativo ?? true,
    createdAt: current?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  }
}

export async function createStoreKpi(
  siglaInput: string,
  input: StoreKpiInput & { id?: string },
): Promise<StoreKpi> {
  const sigla = assertLojaSigla(siglaInput)
  if (input.nome.trim().length < 2) throw new Error('Nome do KPI deve ter pelo menos 2 caracteres.')
  const existing = await listStoreKpis(sigla)
  const id = input.id?.trim() || newId('k')
  const kpi = buildKpiPayload(
    id,
    input,
    null,
    existing.length === 0 ? 0 : Math.max(...existing.map((k) => k.ordem)) + 1,
  )
  // Não gravar array subs no nó raiz
  const { subs: _subs, ...payload } = kpi
  await set(ref(database, storeKpiPath(sigla, id)), payload)
  return kpi
}

export async function updateStoreKpi(
  siglaInput: string,
  kpiId: string,
  input: StoreKpiInput & { ordem?: number },
): Promise<StoreKpi> {
  const sigla = assertLojaSigla(siglaInput)
  const path = storeKpiPath(sigla, kpiId)
  const snap = await get(ref(database, path))
  if (!snap.exists()) throw new Error('KPI não encontrado.')
  const current = mapKpi(kpiId, snap.val() as Partial<StoreKpi>)
  if (!current) throw new Error('KPI inválido na nuvem.')
  if (input.nome.trim().length < 2) throw new Error('Nome do KPI deve ter pelo menos 2 caracteres.')

  const kpi = buildKpiPayload(kpiId, input, current, input.ordem ?? current.ordem)
  const { subs: _subs, ...payload } = kpi
  // preserva nó /subs
  await update(ref(database, path), payload)
  return { ...kpi, subs: current.subs }
}

/** Cria ou atualiza o mesmo id (usado no escopo TODOS). */
export async function upsertStoreKpi(
  siglaInput: string,
  kpiId: string,
  input: StoreKpiInput & { ordem?: number },
): Promise<StoreKpi> {
  const sigla = assertLojaSigla(siglaInput)
  const path = storeKpiPath(sigla, kpiId)
  const snap = await get(ref(database, path))
  if (!snap.exists()) {
    return createStoreKpi(sigla, { ...input, id: kpiId })
  }
  return updateStoreKpi(sigla, kpiId, input)
}

export async function deleteStoreKpi(siglaInput: string, kpiId: string): Promise<void> {
  const sigla = assertLojaSigla(siglaInput)
  await remove(ref(database, storeKpiPath(sigla, kpiId)))
}

/** Aplica a mesma operação em várias lojas (escopo TODOS). */
export async function forEachStoreSigla<T>(
  siglas: string[],
  fn: (sigla: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = []
  for (const sigla of siglas) {
    results.push(await fn(sigla))
  }
  return results
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

export type StoreKpiSubInput = {
  nome: string
  kind?: IndicatorKind
  alvoUnidade?: AlvoUnidade | null
  checkIn?: boolean
  checkOut?: boolean
  formula?: ConversionFormula | null
  ativo?: boolean
}

function buildSubPayload(
  id: string,
  input: StoreKpiSubInput,
  current: StoreKpiSub | null,
  ordem: number,
): StoreKpiSub {
  const kind = input.kind ?? current?.kind ?? 'volume'
  const checkIn = input.checkIn ?? current?.checkIn ?? false
  const checkOut = input.checkOut ?? current?.checkOut ?? false
  const formula =
    input.formula !== undefined ? input.formula : (current?.formula ?? null)
  const alvoUnidade =
    kind === 'alvo'
      ? normalizeAlvoUnidade(
          kind,
          input.alvoUnidade !== undefined ? input.alvoUnidade : current?.alvoUnidade,
        )
      : null
  if (kind === 'alvo' && !alvoUnidade) {
    throw new Error('Sub alvo: selecione a unidade (%, absoluto ou só evidenciar).')
  }
  validateFormula(kind, kind === 'conversao' ? formula : null)
  return {
    id,
    nome: input.nome.trim(),
    kind,
    alvoUnidade,
    checkIn,
    checkOut,
    formula: kind === 'conversao' ? formula : null,
    ordem,
    ativo: input.ativo ?? current?.ativo ?? true,
    createdAt: current?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  }
}

export async function createStoreKpiSub(
  siglaInput: string,
  kpiId: string,
  input: StoreKpiSubInput & { id?: string },
): Promise<StoreKpiSub> {
  const sigla = assertLojaSigla(siglaInput)
  if (input.nome.trim().length < 2) throw new Error('Nome do sub deve ter pelo menos 2 caracteres.')
  const parentSnap = await get(ref(database, storeKpiPath(sigla, kpiId)))
  if (!parentSnap.exists()) throw new Error('KPI-mãe não encontrado.')

  const subsSnap = await get(ref(database, storeKpiSubsPath(sigla, kpiId)))
  const existing = subsSnap.exists()
    ? Object.entries(subsSnap.val() as Record<string, Partial<StoreKpiSub>>)
        .map(([id, raw]) => mapSub(id, raw))
        .filter((item): item is StoreKpiSub => item != null)
    : []
  const id = input.id?.trim() || newId('s')
  const sub = buildSubPayload(
    id,
    input,
    null,
    existing.length === 0 ? 0 : Math.max(...existing.map((s) => s.ordem)) + 1,
  )
  await set(ref(database, storeKpiSubPath(sigla, kpiId, id)), sub)
  return sub
}

export async function updateStoreKpiSub(
  siglaInput: string,
  kpiId: string,
  subId: string,
  input: StoreKpiSubInput & { ordem?: number },
): Promise<StoreKpiSub> {
  const sigla = assertLojaSigla(siglaInput)
  const path = storeKpiSubPath(sigla, kpiId, subId)
  const snap = await get(ref(database, path))
  if (!snap.exists()) throw new Error('Subindicador não encontrado.')
  const current = mapSub(subId, snap.val() as Partial<StoreKpiSub>)
  if (!current) throw new Error('Sub inválido na nuvem.')
  if (input.nome.trim().length < 2) throw new Error('Nome do sub deve ter pelo menos 2 caracteres.')
  const sub = buildSubPayload(subId, input, current, input.ordem ?? current.ordem)
  await set(ref(database, path), sub)
  return sub
}

export async function upsertStoreKpiSub(
  siglaInput: string,
  kpiId: string,
  subId: string,
  input: StoreKpiSubInput & { ordem?: number },
): Promise<StoreKpiSub> {
  const sigla = assertLojaSigla(siglaInput)
  const path = storeKpiSubPath(sigla, kpiId, subId)
  const snap = await get(ref(database, path))
  if (!snap.exists()) {
    return createStoreKpiSub(sigla, kpiId, { ...input, id: subId })
  }
  return updateStoreKpiSub(sigla, kpiId, subId, input)
}

export async function deleteStoreKpiSub(
  siglaInput: string,
  kpiId: string,
  subId: string,
): Promise<void> {
  const sigla = assertLojaSigla(siglaInput)
  await remove(ref(database, storeKpiSubPath(sigla, kpiId, subId)))
}

/** Opções para montar fórmula de conversão. */
export function formulaOptionsFromKpis(kpis: StoreKpi[]): {
  value: string
  label: string
  operand: ConversionFormula['numerator']
}[] {
  const options: {
    value: string
    label: string
    operand: ConversionFormula['numerator']
  }[] = []
  for (const kpi of kpis) {
    options.push({
      value: `kpi:${kpi.id}`,
      label: kpi.nome,
      operand: { scope: 'kpi', kpiId: kpi.id },
    })
    for (const sub of kpi.subs ?? []) {
      options.push({
        value: `sub:${kpi.id}:${sub.id}`,
        label: `${kpi.nome} → ${sub.nome}`,
        operand: { scope: 'sub', kpiId: kpi.id, subId: sub.id },
      })
    }
  }
  return options
}

export function operandToSelectValue(operand: ConversionFormula['numerator'] | null | undefined): string {
  if (!operand) return ''
  if (operand.scope === 'sub') return `sub:${operand.kpiId}:${operand.subId}`
  return `kpi:${operand.kpiId}`
}

export function selectValueToOperand(value: string): ConversionFormula['numerator'] | null {
  if (!value) return null
  if (value.startsWith('sub:')) {
    const [, kpiId, subId] = value.split(':')
    if (!kpiId || !subId) return null
    return { scope: 'sub', kpiId, subId }
  }
  if (value.startsWith('kpi:')) {
    const kpiId = value.slice(4)
    if (!kpiId) return null
    return { scope: 'kpi', kpiId }
  }
  return null
}

export function formulaLabel(
  formula: ConversionFormula | null | undefined,
  kpis: StoreKpi[],
): string {
  if (!formula) return '—'
  const options = formulaOptionsFromKpis(kpis)
  const num =
    options.find((o) => o.value === operandToSelectValue(formula.numerator))?.label ?? '?'
  const den =
    options.find((o) => o.value === operandToSelectValue(formula.denominator))?.label ?? '?'
  return `${num} ÷ ${den}`
}

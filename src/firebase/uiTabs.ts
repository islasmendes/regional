import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database'
import {
  DEFAULT_TAB_ORDER,
  isPainelTabId,
  PAINEL_TAB_REGISTRY,
  type PainelTabId,
} from '../painel/tabs/registry'
import { database } from './config'
import { masterUiTabsPath } from './paths'
import type { PainelTabsConfig } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

export function defaultTabsConfig(): PainelTabsConfig {
  const enabled: PainelTabsConfig['enabled'] = {}
  const groups: PainelTabsConfig['groups'] = {}
  for (const tab of PAINEL_TAB_REGISTRY) {
    enabled[tab.id] = tab.defaultEnabled
    groups[tab.id] = tab.group
  }
  return {
    order: [...DEFAULT_TAB_ORDER],
    enabled,
    groups,
    updatedAt: nowIso(),
  }
}

export function normalizeTabsConfig(raw: unknown): PainelTabsConfig {
  const fallback = defaultTabsConfig()
  if (!raw || typeof raw !== 'object') return fallback
  const value = raw as Partial<PainelTabsConfig>
  const orderFromCloud = Array.isArray(value.order)
    ? value.order.filter((id): id is PainelTabId => typeof id === 'string' && isPainelTabId(id))
    : []
  const order = [
    ...orderFromCloud,
    ...DEFAULT_TAB_ORDER.filter((id) => !orderFromCloud.includes(id)),
  ]
  return {
    order,
    enabled: { ...fallback.enabled, ...(value.enabled ?? {}) },
    groups: { ...fallback.groups, ...(value.groups ?? {}) },
    updatedAt: value.updatedAt ?? nowIso(),
  }
}

export async function readTabsConfig(): Promise<PainelTabsConfig> {
  const snap = await get(ref(database, masterUiTabsPath()))
  if (!snap.exists()) return defaultTabsConfig()
  return normalizeTabsConfig(snap.val())
}

export function subscribeTabsConfig(callback: (config: PainelTabsConfig) => void): Unsubscribe {
  return onValue(ref(database, masterUiTabsPath()), (snap) => {
    callback(snap.exists() ? normalizeTabsConfig(snap.val()) : defaultTabsConfig())
  })
}

export async function saveTabsConfig(config: PainelTabsConfig): Promise<void> {
  const payload: PainelTabsConfig = {
    ...normalizeTabsConfig(config),
    updatedAt: nowIso(),
  }
  await set(ref(database, masterUiTabsPath()), payload)
}

export function moveTabOrder(
  order: PainelTabId[],
  id: PainelTabId,
  direction: 'up' | 'down',
): PainelTabId[] {
  const next = [...order]
  const index = next.indexOf(id)
  if (index < 0) return next
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

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

/** Indicador isolado por loja: stores/{SIGLA}/kpis/{id} */
export type StoreKpi = {
  id: string
  nome: string
  cor: string
  /** Gestor lança planejado (IN). */
  checkIn: boolean
  /** Gestor lança realizado (OUT). */
  checkOut: boolean
  ordem: number
  ativo: boolean
  createdAt: string
  updatedAt: string
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

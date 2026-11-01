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

/** Persistência da organização das abas na raiz. */
export type PainelTabsConfig = {
  order: PainelTabId[]
  enabled: Partial<Record<PainelTabId, boolean>>
  /** Classificação livre por aba (ex.: operação, config). */
  groups: Partial<Record<PainelTabId, string>>
  updatedAt: string
}

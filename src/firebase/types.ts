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

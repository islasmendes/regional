export type EntityKind = 'loja' | 'invalid'

export function normalizeSigla(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Lojas começam com VC (ex.: VCANT). Outros níveis entram depois. */
export function kindOfSigla(value: string): EntityKind {
  const sigla = normalizeSigla(value)
  if (sigla.length < 3) return 'invalid'
  if (sigla.startsWith('VC')) return 'loja'
  return 'invalid'
}

export function assertLojaSigla(value: string): string {
  const sigla = normalizeSigla(value)
  if (kindOfSigla(sigla) !== 'loja') {
    throw new Error('Sigla de loja inválida. Use o padrão VC… (ex.: VCANT).')
  }
  return sigla
}

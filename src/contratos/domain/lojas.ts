/** Sete lojas da Regional RSDSU — Localiza Seminovos. */
export const RSDSU_LOJAS = [
  { sigla: 'VCCCO', nome: 'Chapecó' },
  { sigla: 'VCFLN', nome: 'São José — Campinas' },
  { sigla: 'VCITJ', nome: 'Itajaí' },
  { sigla: 'VCLDC', nome: 'Lages' },
  { sigla: 'VCSCP', nome: 'Continente Park' },
  { sigla: 'VCSIT', nome: 'Shopping Itajaí' },
  { sigla: 'VCSJE', nome: 'São José — Barreiros' },
] as const

export type RsdsuSigla = (typeof RSDSU_LOJAS)[number]['sigla']

export const RSDSU_SIGLAS: readonly RsdsuSigla[] = RSDSU_LOJAS.map((l) => l.sigla)

export function isRsdsuSigla(value: string): value is RsdsuSigla {
  return (RSDSU_SIGLAS as readonly string[]).includes(value.toUpperCase())
}

export function lojaNome(sigla: string): string {
  const found = RSDSU_LOJAS.find((l) => l.sigla === sigla.toUpperCase())
  return found?.nome ?? sigla
}

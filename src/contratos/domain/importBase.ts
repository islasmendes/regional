import { buildContractId, firstNameOnly, normalizeToken } from './contractId'
import { toIsoDate } from './dates'
import { isRsdsuSigla } from './lojas'
import type { ActiveBase, ContractRecord, ImportResult } from './types'

/** Cabeçalhos aceitos (variações do export corporativo). */
export const REQUIRED_HEADER_ALIASES: Record<keyof Pick<
  ContractRecord,
  | 'loja'
  | 'placa'
  | 'valorConciliado'
  | 'pctPagtoConfirmado'
  | 'diasAbertoPrimeiro'
  | 'diasAbertoAtual'
  | 'cvEv'
  | 'codigoContratoAtual'
  | 'codigoPrimeiroContrato'
>, string[]> = {
  loja: ['loja', 'sigla', 'filial', 'unidade'],
  placa: ['placa'],
  valorConciliado: [
    'valor conciliado contrato',
    'valor conciliado',
    'valor_conciliado_contrato',
    'vlr conciliado contrato',
  ],
  pctPagtoConfirmado: [
    '% pagto. confirmado',
    '% pagto confirmado',
    'pct pagto confirmado',
    '% pagamento confirmado',
    'percentual pagto confirmado',
  ],
  diasAbertoPrimeiro: [
    'dias em aberto (primeiro contrato)',
    'dias em aberto primeiro contrato',
    'dias aberto primeiro',
  ],
  diasAbertoAtual: [
    'dias em aberto (contrato atual)',
    'dias em aberto contrato atual',
    'dias aberto atual',
  ],
  cvEv: ['cv/ev', 'cv ev', 'vendedor', 'consultor'],
  codigoContratoAtual: [
    'código contrato atual',
    'codigo contrato atual',
    'cod contrato atual',
    'contrato atual',
  ],
  codigoPrimeiroContrato: [
    'código primeiro contrato',
    'codigo primeiro contrato',
    'cod primeiro contrato',
    'primeiro contrato',
  ],
}

export type RawRow = Record<string, unknown>

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function mapHeaders(headers: string[]): Map<string, number> | { error: string } {
  const normalized = headers.map(normalizeHeader)
  const map = new Map<string, number>()

  for (const [field, aliases] of Object.entries(REQUIRED_HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.some((a) => normalizeHeader(a) === h))
    if (idx < 0 && (field === 'loja' || field === 'placa')) {
      return { error: `Cabeçalho obrigatório ausente: ${field}` }
    }
    if (idx >= 0) map.set(field, idx)
  }

  if (!map.has('loja') || !map.has('placa')) {
    return { error: 'Cabeçalhos inválidos: é necessário Loja e Placa.' }
  }
  return map
}

function cellAt(row: unknown[], index: number | undefined): unknown {
  if (index == null) return null
  return row[index] ?? null
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value).trim()
  if (!raw) return null
  // Percentual "85%" ou "0,85"
  const pct = raw.endsWith('%')
  const cleaned = raw
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
  // BR: 1.234,56 → 1234.56
  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  if (pct) return n > 1 ? n / 100 : n
  return n
}

function asPct(value: unknown): number | null {
  const n = asNumber(value)
  if (n == null) return null
  // Se veio 85 em vez de 0.85
  if (n > 1 && n <= 100) return n / 100
  return n
}

function asText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((c) => c == null || String(c).trim() === '')
}

export function parseRawMatrix(
  headers: string[],
  rows: unknown[][],
): { contracts: ContractRecord[] } | { error: string } {
  const mapped = mapHeaders(headers)
  if ('error' in mapped) return mapped

  const contracts: ContractRecord[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    if (!Array.isArray(row) || isEmptyRow(row)) continue

    const lojaRaw = asText(cellAt(row, mapped.get('loja')))
    const placa = normalizeToken(asText(cellAt(row, mapped.get('placa'))))
    if (!lojaRaw && !placa) continue
    if (!placa) continue

    const lojaNorm = normalizeToken(lojaRaw)
    const loja = isRsdsuSigla(lojaNorm) ? lojaNorm : lojaNorm

    const codigoAtual = asText(cellAt(row, mapped.get('codigoContratoAtual')))
    const codigoPrimeiro = asText(cellAt(row, mapped.get('codigoPrimeiroContrato')))
    const id = buildContractId({
      codigoPrimeiroContrato: codigoPrimeiro,
      codigoContratoAtual: codigoAtual,
      placa,
    })
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)

    contracts.push({
      id,
      loja,
      placa,
      valorConciliado: asNumber(cellAt(row, mapped.get('valorConciliado'))),
      pctPagtoConfirmado: asPct(cellAt(row, mapped.get('pctPagtoConfirmado'))),
      diasAbertoPrimeiro: asNumber(cellAt(row, mapped.get('diasAbertoPrimeiro'))),
      diasAbertoAtual: asNumber(cellAt(row, mapped.get('diasAbertoAtual'))),
      cvEv: firstNameOnly(asText(cellAt(row, mapped.get('cvEv')))),
      codigoContratoAtual: codigoAtual,
      codigoPrimeiroContrato: codigoPrimeiro || codigoAtual,
    })
  }

  return { contracts }
}

/**
 * Substituição integral e atômica da base ativa.
 * Em caso de erro de validação, preserva a última base válida.
 */
export function replaceActiveBase(input: {
  previous: ActiveBase | null
  headers: string[]
  rows: unknown[][]
  sourceFileName: string
  now?: Date
  /** Permite base validamente vazia (0 contratos). */
  allowEmpty?: boolean
}): ImportResult {
  const now = input.now ?? new Date()
  const parsed = parseRawMatrix(input.headers, input.rows)

  if ('error' in parsed) {
    return {
      ok: false,
      error: parsed.error,
      preservedBase: input.previous,
    }
  }

  if (parsed.contracts.length === 0 && input.allowEmpty === false) {
    return {
      ok: false,
      error: 'Arquivo sem contratos válidos. A base anterior foi preservada.',
      preservedBase: input.previous,
    }
  }

  // Cabeçalhos presentes mas arquivo claramente inválido (sem loja/placa em linha alguma
  // e previous existia com dados) — se allowEmpty true, aceita 0.
  const previousCount = input.previous?.contracts.length ?? 0
  const base: ActiveBase = {
    meta: {
      importedAt: now.toISOString(),
      recordCount: parsed.contracts.length,
      sourceFileName: input.sourceFileName,
      cycleDate: toIsoDate(now),
    },
    contracts: parsed.contracts,
  }

  return {
    ok: true,
    base,
    removedCount: Math.max(0, previousCount - base.contracts.length),
    previousCount,
  }
}

/** Valida se a matriz parece um export (pelo menos Loja + Placa). */
export function validateImportHeaders(headers: string[]): string | null {
  const mapped = mapHeaders(headers)
  return 'error' in mapped ? mapped.error : null
}

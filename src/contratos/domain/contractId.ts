/**
 * Identificador estável do contrato.
 * Prioriza código do primeiro contrato (cobre refazimentos),
 * depois o contrato atual, e usa a placa como reforço.
 * Nunca usar só a posição da linha nem só a placa.
 */
export function buildContractId(input: {
  codigoPrimeiroContrato?: string | null
  codigoContratoAtual?: string | null
  placa?: string | null
}): string {
  const primeiro = normalizeToken(input.codigoPrimeiroContrato)
  const atual = normalizeToken(input.codigoContratoAtual)
  const placa = normalizeToken(input.placa)
  const codigo = primeiro || atual
  if (!codigo && !placa) return ''
  return `${codigo}|${placa}`
}

export function normalizeToken(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/** Primeiro nome do CV/EV (ex.: "JOÃO SILVA" → "JOÃO"). */
export function firstNameOnly(cvEv: string | null | undefined): string {
  if (!cvEv) return ''
  const trimmed = String(cvEv).trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? ''
}

/** Resolve se dois registros representam o mesmo vínculo contratual. */
export function sameContractFamily(
  a: { codigoPrimeiroContrato?: string; codigoContratoAtual?: string; placa?: string },
  b: { codigoPrimeiroContrato?: string; codigoContratoAtual?: string; placa?: string },
): boolean {
  const idA = buildContractId(a)
  const idB = buildContractId(b)
  if (idA && idB && idA === idB) return true

  const pA = normalizeToken(a.codigoPrimeiroContrato) || normalizeToken(a.codigoContratoAtual)
  const pB = normalizeToken(b.codigoPrimeiroContrato) || normalizeToken(b.codigoContratoAtual)
  if (pA && pB && pA === pB) return true

  return false
}

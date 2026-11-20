/** Paths RTDB do módulo de contratos (raiz regional). */

export function contratosRootPath(): string {
  return 'contratos'
}

export function contratosActivePath(): string {
  return `${contratosRootPath()}/active`
}

export function contratosJustificationsPath(): string {
  return `${contratosRootPath()}/justifications`
}

export function contratosJustificationPath(contractId: string): string {
  return `${contratosJustificationsPath()}/${encodeContractKey(contractId)}`
}

export function contratosForecastHistoryPath(): string {
  return `${contratosRootPath()}/forecastHistory`
}

export function contratosForecastContractPath(contractId: string): string {
  return `${contratosForecastHistoryPath()}/${encodeContractKey(contractId)}`
}

export function contratosClosingMonthPath(monthKey: string): string {
  return `${contratosRootPath()}/closing/${monthKey}`
}

export function contratosClosingStorePath(monthKey: string, sigla: string): string {
  return `${contratosClosingMonthPath(monthKey)}/${sigla.toUpperCase()}`
}

export function contratosImportLogPath(): string {
  return `${contratosRootPath()}/importLog`
}

/** RTDB não aceita `.` `#` `$` `[` `]` `/` nas chaves. */
export function encodeContractKey(id: string): string {
  return id.replace(/[.#$/[\]]/g, '_')
}

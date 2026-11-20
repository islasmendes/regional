import * as XLSX from 'xlsx'
import { replaceActiveBase, validateImportHeaders } from '../domain/importBase'
import type { ActiveBase, ImportResult } from '../domain/types'

export type ParsedWorkbook = {
  headers: string[]
  rows: unknown[][]
  sheetName: string
}

/**
 * Lê o primeiro sheet de um ArrayBuffer (xlsx/xls/csv).
 * Não aplica a importação — só interpreta a matriz.
 */
export function parseWorkbookBuffer(buffer: ArrayBuffer): ParsedWorkbook | { error: string } {
  try {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { error: 'Arquivo sem planilhas.' }
    const sheet = wb.Sheets[sheetName]
    if (!sheet) return { error: 'Planilha vazia ou ilegível.' }

    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][]

    if (!matrix.length) return { error: 'Planilha sem linhas.' }

    const headerRow = matrix[0] ?? []
    const headers = headerRow.map((h) => (h == null ? '' : String(h)))
    const headerError = validateImportHeaders(headers)
    if (headerError) return { error: headerError }

    const rows = matrix.slice(1)
    return { headers, rows, sheetName }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Falha ao ler o arquivo.',
    }
  }
}

/** Operação atômica: parse + replace. Em erro, preserva previous. */
export function importNewBaseFromFile(input: {
  buffer: ArrayBuffer
  fileName: string
  previous: ActiveBase | null
  now?: Date
  allowEmpty?: boolean
}): ImportResult {
  const parsed = parseWorkbookBuffer(input.buffer)
  if ('error' in parsed) {
    return { ok: false, error: parsed.error, preservedBase: input.previous }
  }
  return replaceActiveBase({
    previous: input.previous,
    headers: parsed.headers,
    rows: parsed.rows,
    sourceFileName: input.fileName,
    now: input.now,
    allowEmpty: input.allowEmpty ?? true,
  })
}

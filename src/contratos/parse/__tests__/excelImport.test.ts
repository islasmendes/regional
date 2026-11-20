import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { importNewBaseFromFile, parseWorkbookBuffer } from '../excelImport'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(here, '../../fixtures/amostra_30.csv')

describe('excelImport — fixture CSV', () => {
  it('lê amostra_30 e substitui base anterior de 50 por 30', () => {
    const nodeBuf = readFileSync(fixturePath)
    const buffer = nodeBuf.buffer.slice(
      nodeBuf.byteOffset,
      nodeBuf.byteOffset + nodeBuf.byteLength,
    )
    const parsed = parseWorkbookBuffer(buffer)
    expect('error' in parsed).toBe(false)
    if ('error' in parsed) return
    expect(parsed.headers[0]).toMatch(/loja/i)

    const fakePrev = importNewBaseFromFile({
      buffer,
      fileName: 'amostra_30.csv',
      previous: null,
    })
    expect(fakePrev.ok).toBe(true)
    if (!fakePrev.ok) return
    expect(fakePrev.base.contracts).toHaveLength(30)

    // Simula base maior anterior
    const bigger = {
      ...fakePrev.base,
      contracts: [
        ...fakePrev.base.contracts,
        ...Array.from({ length: 20 }, (_, i) => ({
          ...fakePrev.base.contracts[0]!,
          id: `EXTRA${i}|ZZZ${i}`,
          placa: `ZZZ${i}`,
        })),
      ],
      meta: { ...fakePrev.base.meta, recordCount: 50 },
    }

    const replaced = importNewBaseFromFile({
      buffer,
      fileName: 'amostra_30.csv',
      previous: bigger,
    })
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return
    expect(replaced.base.contracts).toHaveLength(30)
    expect(replaced.removedCount).toBe(20)
    expect(replaced.base.contracts.every((c) => c.cvEv.split(' ').length === 1)).toBe(true)
  })
})

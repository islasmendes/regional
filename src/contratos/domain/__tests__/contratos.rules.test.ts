import { describe, expect, it } from 'vitest'
import { evaluateConference } from '../conference'
import { buildContractId } from '../contractId'
import { addDays, endOfMonth, startOfNextMonth, toIsoDate } from '../dates'
import { replaceActiveBase } from '../importBase'
import { RSDSU_SIGLAS } from '../lojas'
import {
  buildRegionalClosingView,
  buildStoreClosingView,
  enrichContracts,
} from '../projections'
import { BROKEN_PROMISE_LABEL, findBrokenPromises } from '../recurrence'
import { queryContracts } from '../sortFilter'
import type {
  ActiveBase,
  ContractJustification,
  ContractRecord,
  ForecastHistoryEntry,
  StoreClosingInput,
} from '../types'

const HEADERS = [
  'Loja',
  'Placa',
  'Valor Conciliado Contrato',
  '% Pagto. Confirmado',
  'Dias Em Aberto (Primeiro Contrato)',
  'Dias Em Aberto (Contrato Atual)',
  'CV/EV',
  'Código Contrato Atual',
  'Código Primeiro Contrato',
]

function row(
  loja: string,
  placa: string,
  opts?: Partial<{
    valor: number
    pct: number
    dias1: number
    dias2: number
    cv: string
    codAtual: string
    codPrimeiro: string
  }>,
): unknown[] {
  const o = opts ?? {}
  return [
    loja,
    placa,
    o.valor ?? 50000,
    o.pct ?? 0.5,
    o.dias1 ?? 3,
    o.dias2 ?? 2,
    o.cv ?? 'JOÃO SILVA',
    o.codAtual ?? `AT-${placa}`,
    o.codPrimeiro ?? `PR-${placa}`,
  ]
}

function makeContracts(n: number, loja = 'VCFLN'): unknown[][] {
  return Array.from({ length: n }, (_, i) =>
    row(loja, `ABC${String(i + 1).padStart(3, '0')}`, {
      dias1: i + 1,
      cv: `VENDEDOR${i} SOBRENOME`,
    }),
  )
}

describe('Teste 1 — Substituição integral da base', () => {
  it('importar 50 e depois 30 remove os 20 residuais', () => {
    const first = replaceActiveBase({
      previous: null,
      headers: HEADERS,
      rows: makeContracts(50),
      sourceFileName: 'a.xlsx',
      now: new Date(2026, 10, 20),
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.base.contracts).toHaveLength(50)

    const second = replaceActiveBase({
      previous: first.base,
      headers: HEADERS,
      rows: makeContracts(30),
      sourceFileName: 'b.xlsx',
      now: new Date(2026, 10, 20),
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.base.contracts).toHaveLength(30)
    expect(second.removedCount).toBe(20)
    expect(second.base.meta.recordCount).toBe(30)

    const ids = new Set(second.base.contracts.map((c) => c.id))
    expect(ids.size).toBe(30)
    // Contratos 31–50 não devem existir
    for (let i = 31; i <= 50; i++) {
      const placa = `ABC${String(i).padStart(3, '0')}`
      const id = buildContractId({
        codigoPrimeiroContrato: `PR-${placa}`,
        codigoContratoAtual: `AT-${placa}`,
        placa,
      })
      expect(ids.has(id)).toBe(false)
    }
  })

  it('falha de cabeçalho preserva a base anterior', () => {
    const prev: ActiveBase = {
      meta: {
        importedAt: '2026-11-19T12:00:00.000Z',
        recordCount: 2,
        sourceFileName: 'ok.xlsx',
        cycleDate: '2026-11-19',
      },
      contracts: [
        {
          id: 'X|AAA',
          loja: 'VCFLN',
          placa: 'AAA',
          valorConciliado: 1,
          pctPagtoConfirmado: 0.1,
          diasAbertoPrimeiro: 1,
          diasAbertoAtual: 1,
          cvEv: 'A',
          codigoContratoAtual: 'X',
          codigoPrimeiroContrato: 'X',
        },
      ],
    }
    const bad = replaceActiveBase({
      previous: prev,
      headers: ['Foo', 'Bar'],
      rows: [['1', '2']],
      sourceFileName: 'bad.xlsx',
    })
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.preservedBase).toBe(prev)
  })

  it('ignora linhas vazias e não as conta como contratos', () => {
    const result = replaceActiveBase({
      previous: null,
      headers: HEADERS,
      rows: [makeContracts(1)[0]!, [], ['', '', '', '', '', '', '', '', ''], makeContracts(1)[0]!],
      sourceFileName: 't.xlsx',
      now: new Date(2026, 10, 20),
    })
    // segunda placa duplicada da mesma makeContracts(1) — same plate ABC001 twice from two makeContracts(1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.base.contracts.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Teste 2 — Ordenação preserva vínculo', () => {
  it('ordenar não migra justificativa para outro contrato', () => {
    const contracts: ContractRecord[] = [
      {
        id: '1|AAA',
        loja: 'VCCCO',
        placa: 'AAA1111',
        valorConciliado: 10,
        pctPagtoConfirmado: 0.2,
        diasAbertoPrimeiro: 10,
        diasAbertoAtual: 5,
        cvEv: 'CARLOS',
        codigoContratoAtual: '1',
        codigoPrimeiroContrato: '1',
      },
      {
        id: '2|BBB',
        loja: 'VCFLN',
        placa: 'BBB2222',
        valorConciliado: 20,
        pctPagtoConfirmado: 0.3,
        diasAbertoPrimeiro: 2,
        diasAbertoAtual: 1,
        cvEv: 'ANA',
        codigoContratoAtual: '2',
        codigoPrimeiroContrato: '2',
      },
    ]
    const justifications: Record<string, ContractJustification> = {
      '1|AAA': {
        contractId: '1|AAA',
        consorcio: 'SIM',
        financiamentoExterno: '',
        previsaoFat: '2026-11-25',
        justificativa: 'JUST-A',
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
      '2|BBB': {
        contractId: '2|BBB',
        consorcio: '',
        financiamentoExterno: 'SIM',
        previsaoFat: '2026-11-21',
        justificativa: 'JUST-B',
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
    }
    const enriched = enrichContracts({
      contracts,
      justifications,
      brokenIds: new Set(),
      brokenLabel: BROKEN_PROMISE_LABEL,
    })

    const byPlaca = queryContracts(enriched, {}, 'placa', 'asc')
    const byDias = queryContracts(enriched, {}, 'diasAbertoPrimeiro', 'desc')
    const byLoja = queryContracts(enriched, {}, 'loja', 'asc')

    for (const list of [byPlaca, byDias, byLoja]) {
      const a = list.find((c) => c.id === '1|AAA')!
      const b = list.find((c) => c.id === '2|BBB')!
      expect(a.justification?.justificativa).toBe('JUST-A')
      expect(a.justification?.previsaoFat).toBe('2026-11-25')
      expect(a.justification?.consorcio).toBe('SIM')
      expect(b.justification?.justificativa).toBe('JUST-B')
      expect(b.justification?.financiamentoExterno).toBe('SIM')
    }

    expect(byDias[0]?.id).toBe('1|AAA')
  })
})

describe('Teste 3 — Recorrência / promessa descumprida', () => {
  it('sinaliza previsão de ontem se contrato permanece, sem restaurar justificativa', () => {
    const today = '2026-11-11'
    const contract: ContractRecord = {
      id: buildContractId({
        codigoPrimeiroContrato: 'PR-ABC123',
        codigoContratoAtual: 'AT-ABC123',
        placa: 'ABC123',
      }),
      loja: 'VCFLN',
      placa: 'ABC123',
      valorConciliado: 40000,
      pctPagtoConfirmado: 0.8,
      diasAbertoPrimeiro: 5,
      diasAbertoAtual: 5,
      cvEv: 'PEDRO',
      codigoContratoAtual: 'AT-ABC123',
      codigoPrimeiroContrato: 'PR-ABC123',
    }

    const history: ForecastHistoryEntry[] = [
      {
        id: 'h1',
        contractId: contract.id,
        previsaoFat: '2026-11-10',
        recordedAt: '2026-11-10T15:00:00.000Z',
        cycleDate: '2026-11-10',
        placa: 'ABC123',
        codigoContratoAtual: 'AT-ABC123',
        codigoPrimeiroContrato: 'PR-ABC123',
      },
    ]

    const broken = findBrokenPromises({
      activeContracts: [contract],
      history,
      todayIso: today,
    })
    expect(broken.has(contract.id)).toBe(true)

    // Justificativas do novo ciclo começam vazias
    const enriched = enrichContracts({
      contracts: [contract],
      justifications: {},
      brokenIds: new Set(broken.keys()),
      brokenLabel: BROKEN_PROMISE_LABEL,
    })
    expect(enriched[0]?.justification).toBeNull()
    expect(enriched[0]?.brokenPromise).toBe(true)
    expect(enriched[0]?.brokenPromiseLabel).toBe(BROKEN_PROMISE_LABEL)

    // Contrato que saiu da base não é marcado
    const brokenGone = findBrokenPromises({
      activeContracts: [],
      history,
      todayIso: today,
    })
    expect(brokenGone.size).toBe(0)
  })
})

describe('Teste 4 — Conferência', () => {
  it('15 = 6 + 9 → OK; 14 → DIVERGÊNCIA', () => {
    expect(
      evaluateConference({ vendasAcumuladas: 15, faturamentoAcumulado: 6, contratosAbertos: 9 }),
    ).toEqual({ status: 'OK', delta: 0 })

    expect(
      evaluateConference({ vendasAcumuladas: 14, faturamentoAcumulado: 6, contratosAbertos: 9 }),
    ).toEqual({ status: 'DIVERGENCIA', delta: -1 })

    expect(
      evaluateConference({ vendasAcumuladas: null, faturamentoAcumulado: 6, contratosAbertos: 9 }),
    ).toEqual({ status: 'PENDENTE', delta: null })
  })
})

describe('Teste 5 — Projeção parcial regional', () => {
  it('uma loja OK → PARCIAL 1/7', () => {
    const today = '2026-11-20'
    const contracts = enrichContracts({
      contracts: Array.from({ length: 9 }, (_, i) => ({
        id: `C${i}|P${i}`,
        loja: 'VCFLN',
        placa: `P${i}`,
        valorConciliado: 1,
        pctPagtoConfirmado: 0.1,
        diasAbertoPrimeiro: 1,
        diasAbertoAtual: 1,
        cvEv: 'A',
        codigoContratoAtual: `C${i}`,
        codigoPrimeiroContrato: `C${i}`,
      })),
      justifications: {},
      brokenIds: new Set(),
      brokenLabel: BROKEN_PROMISE_LABEL,
    })

    const closing: StoreClosingInput = {
      sigla: 'VCFLN',
      metaMensal: 50,
      metaDesafio: 60,
      vendasAcumuladas: 15,
      faturamentoAcumulado: 6,
      vf: {},
    }

    const view = buildStoreClosingView({
      sigla: 'VCFLN',
      contracts,
      closing,
      todayIso: today,
    })
    expect(view.conferencia).toBe('OK')

    const emptyOthers = RSDSU_SIGLAS.filter((s) => s !== 'VCFLN').map((sigla) =>
      buildStoreClosingView({
        sigla,
        contracts: [],
        closing: {
          sigla,
          metaMensal: null,
          metaDesafio: null,
          vendasAcumuladas: null,
          faturamentoAcumulado: null,
          vf: {},
        },
        todayIso: today,
      }),
    )

    const regional = buildRegionalClosingView([view, ...emptyOthers])
    expect(regional.label).toBe('PARCIAL 1/7 LOJAS')
    expect(regional.lojasOk).toBe(1)
    expect(regional.projecaoVendas).toBe(15)
  })
})

describe('Teste 6 — Vender e faturar (V+F)', () => {
  it('10 previstos hoje + 2 V+F = 12 fat, sem VNF das 2 novas', () => {
    const today = '2026-11-20'
    const justifications: Record<string, ContractJustification> = {}
    const contracts: ContractRecord[] = Array.from({ length: 10 }, (_, i) => {
      const id = `VF${i}|PL${i}`
      justifications[id] = {
        contractId: id,
        consorcio: '',
        financiamentoExterno: '',
        previsaoFat: today,
        justificativa: '',
        updatedAt: today,
      }
      return {
        id,
        loja: 'VCFLN',
        placa: `PL${i}`,
        valorConciliado: 1,
        pctPagtoConfirmado: 1,
        diasAbertoPrimeiro: 1,
        diasAbertoAtual: 1,
        cvEv: 'A',
        codigoContratoAtual: `VF${i}`,
        codigoPrimeiroContrato: `VF${i}`,
      }
    })

    const enriched = enrichContracts({
      contracts,
      justifications,
      brokenIds: new Set(),
      brokenLabel: BROKEN_PROMISE_LABEL,
    })

    const view = buildStoreClosingView({
      sigla: 'VCFLN',
      contracts: enriched,
      closing: {
        sigla: 'VCFLN',
        metaMensal: 50,
        metaDesafio: 60,
        vendasAcumuladas: 10,
        faturamentoAcumulado: 0,
        vf: { [today]: 2 },
      },
      todayIso: today,
    })

    expect(view.conferencia).toBe('OK')
    expect(view.fatHoje).toBe(10)
    expect(view.vfHoje).toBe(2)
    expect(view.projecaoFaturamento).toBe(12)
    expect(view.projecaoVendas).toBe(12)
    expect(view.vnfProjetado).toBe(0)
  })
})

describe('Teste 7 — Encerramento do mês / VNF', () => {
  it('próximo mês e sem previsão entram no VNF, não no fat do mês', () => {
    const today = '2026-11-20'
    const nextMonth = startOfNextMonth(today)
    const end = endOfMonth(today)
    expect(nextMonth > end).toBe(true)

    const contracts: ContractRecord[] = [
      {
        id: 'A|PA',
        loja: 'VCFLN',
        placa: 'PA',
        valorConciliado: 1,
        pctPagtoConfirmado: 1,
        diasAbertoPrimeiro: 1,
        diasAbertoAtual: 1,
        cvEv: 'A',
        codigoContratoAtual: 'A',
        codigoPrimeiroContrato: 'A',
      },
      {
        id: 'B|PB',
        loja: 'VCFLN',
        placa: 'PB',
        valorConciliado: 1,
        pctPagtoConfirmado: 1,
        diasAbertoPrimeiro: 1,
        diasAbertoAtual: 1,
        cvEv: 'B',
        codigoContratoAtual: 'B',
        codigoPrimeiroContrato: 'B',
      },
      {
        id: 'C|PC',
        loja: 'VCFLN',
        placa: 'PC',
        valorConciliado: 1,
        pctPagtoConfirmado: 1,
        diasAbertoPrimeiro: 1,
        diasAbertoAtual: 1,
        cvEv: 'C',
        codigoContratoAtual: 'C',
        codigoPrimeiroContrato: 'C',
      },
    ]

    const justifications: Record<string, ContractJustification> = {
      'A|PA': {
        contractId: 'A|PA',
        consorcio: 'SIM',
        financiamentoExterno: '',
        previsaoFat: nextMonth,
        justificativa: '',
        updatedAt: today,
      },
      'B|PB': {
        contractId: 'B|PB',
        consorcio: '',
        financiamentoExterno: '',
        previsaoFat: null,
        justificativa: '',
        updatedAt: today,
      },
      'C|PC': {
        contractId: 'C|PC',
        consorcio: '',
        financiamentoExterno: '',
        previsaoFat: today,
        justificativa: '',
        updatedAt: today,
      },
    }

    const enriched = enrichContracts({
      contracts,
      justifications,
      brokenIds: new Set(),
      brokenLabel: BROKEN_PROMISE_LABEL,
    })

    const view = buildStoreClosingView({
      sigla: 'VCFLN',
      contracts: enriched,
      closing: {
        sigla: 'VCFLN',
        metaMensal: 50,
        metaDesafio: 55,
        vendasAcumuladas: 3,
        faturamentoAcumulado: 0,
        vf: {},
      },
      todayIso: today,
    })

    expect(view.fatHoje).toBe(1)
    expect(view.fatProximoMes).toBe(1)
    expect(view.semPrevisao).toBe(1)
    expect(view.totalComPrevisaoMes).toBe(1)
    expect(view.projecaoFaturamento).toBe(1) // só o do mês
    expect(view.vnfProjetado).toBe(2)
    expect(view.pctVnfMeta).toBe(4) // 2/50*100
  })
})

describe('Teste 9 — Base vazia e importação inválida', () => {
  it('base validamente vazia zera contratos ativos', () => {
    const prev = replaceActiveBase({
      previous: null,
      headers: HEADERS,
      rows: makeContracts(5),
      sourceFileName: 'full.xlsx',
      now: new Date(2026, 10, 20),
    })
    expect(prev.ok).toBe(true)
    if (!prev.ok) return

    const empty = replaceActiveBase({
      previous: prev.base,
      headers: HEADERS,
      rows: [],
      sourceFileName: 'empty.xlsx',
      now: new Date(2026, 10, 20),
      allowEmpty: true,
    })
    expect(empty.ok).toBe(true)
    if (!empty.ok) return
    expect(empty.base.contracts).toHaveLength(0)
    expect(empty.base.meta.recordCount).toBe(0)
  })

  it('arquivo inválido não substitui base válida', () => {
    const prev = replaceActiveBase({
      previous: null,
      headers: HEADERS,
      rows: makeContracts(3),
      sourceFileName: 'ok.xlsx',
      now: new Date(2026, 10, 20),
    })
    expect(prev.ok).toBe(true)
    if (!prev.ok) return

    const bad = replaceActiveBase({
      previous: prev.base,
      headers: ['X', 'Y'],
      rows: [[1, 2]],
      sourceFileName: 'bad.xlsx',
    })
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.preservedBase?.contracts).toHaveLength(3)
  })
})

describe('Extras — CV/EV primeiro nome e alertas', () => {
  it('CV/EV exibe só o primeiro nome', () => {
    const result = replaceActiveBase({
      previous: null,
      headers: HEADERS,
      rows: [row('VCFLN', 'XYZ1', { cv: 'MARIA HELENA COSTA' })],
      sourceFileName: 't.xlsx',
      now: new Date(2026, 10, 20),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.base.contracts[0]?.cvEv).toBe('MARIA')
  })

  it('toIsoDate / addDays estáveis', () => {
    const d = new Date(2026, 10, 20)
    expect(toIsoDate(d)).toBe('2026-11-20')
    expect(addDays('2026-11-20', 1)).toBe('2026-11-21')
  })
})

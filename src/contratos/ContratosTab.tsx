import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeDateField } from '../ui/ThemeDateField'
import { ThemeSelect } from '../ui/ThemeSelect'
import './Contratos.css'
import {
  attainmentTone,
  formatBRL,
  formatInt,
  formatPct,
  gapTone,
} from './domain/format'
import { monthKey, toIsoDate } from './domain/dates'
import { RSDSU_LOJAS, RSDSU_SIGLAS, lojaNome } from './domain/lojas'
import {
  buildRegionalClosingView,
  buildStoreClosingView,
  enrichContracts,
} from './domain/projections'
import { BROKEN_PROMISE_LABEL, findBrokenPromises } from './domain/recurrence'
import {
  queryContracts,
  type JustificationFilters,
  type SortDir,
  type SortKey,
} from './domain/sortFilter'
import type {
  ActiveBase,
  ContractJustification,
  EnrichedContract,
  ForecastHistoryEntry,
  SimBlank,
  StoreClosingInput,
} from './domain/types'
import {
  commitImportFromFile,
  emptyClosing,
  saveJustification,
  saveStoreClosing,
  subscribeActiveBase,
  subscribeClosingMonth,
  subscribeForecastHistory,
  subscribeJustifications,
} from './firebase/contratosRepo'

type Area = 'importacao' | 'base' | 'justificativas' | 'fechamento'

const AREA_LABEL: Record<Area, string> = {
  importacao: 'Importação',
  base: 'Base diária',
  justificativas: 'Justificativas',
  fechamento: 'Gestão fechamento',
}

function todayIso(): string {
  return toIsoDate(new Date())
}

export function ContratosTab() {
  const [area, setArea] = useState<Area>('importacao')
  const [base, setBase] = useState<ActiveBase | null>(null)
  const [justifications, setJustifications] = useState<Record<string, ContractJustification>>({})
  const [history, setHistory] = useState<ForecastHistoryEntry[]>([])
  const [closingMap, setClosingMap] = useState<Record<string, StoreClosingInput>>({})
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad' | 'warn'; text: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [filters, setFilters] = useState<JustificationFilters>({
    loja: 'TODAS',
    consorcio: 'ALL',
    financiamentoExterno: 'ALL',
  })
  const [sortKey, setSortKey] = useState<SortKey>('criticos')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const month = monthKey(todayIso())

  useEffect(() => {
    const u1 = subscribeActiveBase(setBase)
    const u2 = subscribeJustifications(setJustifications)
    const u3 = subscribeForecastHistory(setHistory)
    const u4 = subscribeClosingMonth(month, setClosingMap)
    return () => {
      u1()
      u2()
      u3()
      u4()
    }
  }, [month])

  const brokenMap = useMemo(
    () =>
      findBrokenPromises({
        activeContracts: base?.contracts ?? [],
        history,
        todayIso: todayIso(),
      }),
    [base, history],
  )

  const enriched = useMemo(
    () =>
      enrichContracts({
        contracts: base?.contracts ?? [],
        justifications,
        brokenIds: new Set(brokenMap.keys()),
        brokenLabel: BROKEN_PROMISE_LABEL,
      }),
    [base, justifications, brokenMap],
  )

  const visibleJust = useMemo(
    () => queryContracts(enriched, filters, sortKey, sortDir),
    [enriched, filters, sortKey, sortDir],
  )

  const storeViews = useMemo(() => {
    return RSDSU_SIGLAS.map((sigla) =>
      buildStoreClosingView({
        sigla,
        contracts: enriched,
        closing: closingMap[sigla] ?? emptyClosing(sigla),
        todayIso: todayIso(),
      }),
    )
  }, [enriched, closingMap])

  const regional = useMemo(() => buildRegionalClosingView(storeViews), [storeViews])

  const onImportClick = () => fileRef.current?.click()

  const onFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await commitImportFromFile({ buffer, fileName: file.name })
      if (!result.ok) {
        setMessage({ tone: 'bad', text: `Importação rejeitada: ${result.error}` })
        return
      }
      setMessage({
        tone: 'ok',
        text: `Base substituída: ${result.count} contratos ativos${
          result.removedCount > 0 ? ` · ${result.removedCount} residuais removidos` : ''
        }. Justificativas do ciclo reiniciadas.`,
      })
      setArea('base')
    } catch (error) {
      setMessage({
        tone: 'bad',
        text: error instanceof Error ? error.message : 'Falha na importação.',
      })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const patchClosing = async (sigla: string, patch: Partial<StoreClosingInput>) => {
    const current = closingMap[sigla] ?? emptyClosing(sigla)
    const next = { ...current, ...patch, sigla }
    setClosingMap((prev) => ({ ...prev, [sigla]: next }))
    try {
      await saveStoreClosing({ ...next, monthKey: month })
    } catch (error) {
      setMessage({
        tone: 'bad',
        text: error instanceof Error ? error.message : 'Falha ao salvar fechamento.',
      })
    }
  }

  const patchJustification = async (
    contract: EnrichedContract,
    patch: Partial<{
      consorcio: SimBlank
      financiamentoExterno: SimBlank
      previsaoFat: string | null
      justificativa: string
    }>,
  ) => {
    const current = justifications[contract.id]
    const next = {
      consorcio: patch.consorcio ?? current?.consorcio ?? ('' as SimBlank),
      financiamentoExterno:
        patch.financiamentoExterno ?? current?.financiamentoExterno ?? ('' as SimBlank),
      previsaoFat: patch.previsaoFat !== undefined ? patch.previsaoFat : (current?.previsaoFat ?? null),
      justificativa: patch.justificativa ?? current?.justificativa ?? '',
    }
    setJustifications((prev) => ({
      ...prev,
      [contract.id]: {
        contractId: contract.id,
        ...next,
        updatedAt: new Date().toISOString(),
      },
    }))
    try {
      await saveJustification({
        contract,
        ...next,
        cycleDate: base?.meta.cycleDate ?? todayIso(),
      })
    } catch (error) {
      setMessage({
        tone: 'bad',
        text: error instanceof Error ? error.message : 'Falha ao salvar justificativa.',
      })
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'diasAbertoPrimeiro' || key === 'criticos' ? 'desc' : 'asc')
    }
  }

  return (
    <div className="ct-shell painel-tab">
      <nav className="ct-subnav" aria-label="Áreas de contratos">
        {(Object.keys(AREA_LABEL) as Area[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`ct-subnav-btn ${area === id ? 'is-active' : ''}`}
            onClick={() => setArea(id)}
          >
            {AREA_LABEL[id]}
          </button>
        ))}
      </nav>

      {message && (
        <p
          className={`ct-alert ${
            message.tone === 'ok' ? 'ct-alert--ok' : message.tone === 'bad' ? 'ct-alert--bad' : ''
          }`}
          role="status"
        >
          {message.text}
        </p>
      )}

      {area === 'importacao' && (
        <section className="ct-panel">
          <div className="ct-toolbar">
            <div>
              <p className="ct-muted" style={{ margin: 0 }}>
                Substituição integral da base oficial. Contratos ausentes na nova carga saem de
                todas as áreas.
              </p>
              <div className="ct-meta" style={{ marginTop: '0.75rem' }}>
                <span>
                  Última importação:{' '}
                  <strong>
                    {base?.meta.importedAt
                      ? new Date(base.meta.importedAt).toLocaleString('pt-BR')
                      : '—'}
                  </strong>
                </span>
                <span>
                  Arquivo: <strong>{base?.meta.sourceFileName ?? '—'}</strong>
                </span>
                <span>
                  Contratos ativos: <strong>{base?.meta.recordCount ?? 0}</strong>
                </span>
              </div>
            </div>
            <div>
              <input
                ref={fileRef}
                className="ct-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="painel-btn painel-btn--primary"
                disabled={busy}
                onClick={onImportClick}
              >
                {busy ? 'Importando…' : 'IMPORTAR NOVA BASE'}
              </button>
            </div>
          </div>
        </section>
      )}

      {area === 'base' && (
        <section className="ct-panel">
          <div className="ct-meta">
            <span>
              Contratos: <strong>{enriched.length}</strong>
            </span>
          </div>
          <div className="ct-table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Placa</th>
                  <th>Valor Conciliado</th>
                  <th>% Pagto.</th>
                  <th>Dias 1º contrato</th>
                  <th>Dias contrato atual</th>
                  <th>CV/EV</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((c) => {
                  const critical = (c.diasAbertoPrimeiro ?? 0) > 7
                  const zero =
                    c.valorConciliado == null || c.valorConciliado === 0
                  return (
                    <tr
                      key={c.id}
                      className={`${critical ? 'is-critical' : ''} ${zero ? 'is-zero-value' : ''}`}
                    >
                      <td>{c.loja}</td>
                      <td>{c.placa}</td>
                      <td className={zero ? 'ct-cell-zero' : 'ct-num'}>
                        {formatBRL(c.valorConciliado)}
                      </td>
                      <td className="ct-num">{formatPct(c.pctPagtoConfirmado)}</td>
                      <td className={critical ? 'ct-cell-critical ct-num' : 'ct-num'}>
                        {formatInt(c.diasAbertoPrimeiro)}
                      </td>
                      <td className="ct-num">{formatInt(c.diasAbertoAtual)}</td>
                      <td>{c.cvEv}</td>
                    </tr>
                  )
                })}
                {enriched.length === 0 && (
                  <tr>
                    <td colSpan={7}>Nenhum contrato ativo. Importe uma nova base.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {area === 'justificativas' && (
        <section className="ct-panel">
          <div className="ct-filters">
            <ThemeSelect
              label="Loja"
              value={filters.loja ?? 'TODAS'}
              options={[
                { value: 'TODAS', label: 'Todas' },
                ...RSDSU_LOJAS.map((l) => ({ value: l.sigla, label: `${l.sigla} · ${l.nome}` })),
              ]}
              onChange={(loja) => setFilters((f) => ({ ...f, loja }))}
            />
            <ThemeSelect
              label="Consórcio"
              value={filters.consorcio ?? 'ALL'}
              options={[
                { value: 'ALL', label: 'Todos' },
                { value: 'SIM', label: 'SIM' },
                { value: 'BLANK', label: 'Em branco' },
              ]}
              onChange={(consorcio) =>
                setFilters((f) => ({
                  ...f,
                  consorcio: consorcio as JustificationFilters['consorcio'],
                }))
              }
            />
            <ThemeSelect
              label="Financ. externo"
              value={filters.financiamentoExterno ?? 'ALL'}
              options={[
                { value: 'ALL', label: 'Todos' },
                { value: 'SIM', label: 'SIM' },
                { value: 'BLANK', label: 'Em branco' },
              ]}
              onChange={(financiamentoExterno) =>
                setFilters((f) => ({
                  ...f,
                  financiamentoExterno:
                    financiamentoExterno as JustificationFilters['financiamentoExterno'],
                }))
              }
            />
            <ThemeSelect
              label="Previsão"
              value={filters.semPrevisao ? 'SEM' : filters.brokenOnly ? 'BROKEN' : 'ALL'}
              options={[
                { value: 'ALL', label: 'Todas' },
                { value: 'SEM', label: 'Sem previsão' },
                { value: 'BROKEN', label: 'Não cumpridas' },
              ]}
              onChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  semPrevisao: v === 'SEM',
                  brokenOnly: v === 'BROKEN',
                }))
              }
            />
            <label className="ui-field">
              <span className="ui-field-label">Busca</span>
              <input
                className="ct-input"
                value={filters.query ?? ''}
                placeholder="Placa, loja, CV…"
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              />
            </label>
          </div>

          <div className="ct-table-wrap">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => toggleSort('loja')}>
                      Loja
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => toggleSort('placa')}>
                      Placa
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => toggleSort('diasAbertoPrimeiro')}>
                      Dias abertos
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => toggleSort('cvEv')}>
                      CV/EV
                    </button>
                  </th>
                  <th>Consórcio</th>
                  <th>Financ. ext.</th>
                  <th>
                    <button type="button" onClick={() => toggleSort('previsaoFat')}>
                      Previsão FAT.
                    </button>
                  </th>
                  <th className="ct-just-col">Justificativa</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {visibleJust.map((c) => (
                  <tr key={c.id} className={(c.diasAbertoPrimeiro ?? 0) > 7 ? 'is-critical' : ''}>
                    <td>{c.loja}</td>
                    <td>{c.placa}</td>
                    <td
                      className={
                        (c.diasAbertoPrimeiro ?? 0) > 7 ? 'ct-cell-critical ct-num' : 'ct-num'
                      }
                    >
                      {formatInt(c.diasAbertoPrimeiro)}
                    </td>
                    <td>{c.cvEv}</td>
                    <td>
                      <ThemeSelect
                        value={c.justification?.consorcio ?? ''}
                        options={[
                          { value: '', label: '—' },
                          { value: 'SIM', label: 'SIM' },
                        ]}
                        onChange={(v) =>
                          void patchJustification(c, { consorcio: v as SimBlank })
                        }
                      />
                    </td>
                    <td>
                      <ThemeSelect
                        value={c.justification?.financiamentoExterno ?? ''}
                        options={[
                          { value: '', label: '—' },
                          { value: 'SIM', label: 'SIM' },
                        ]}
                        onChange={(v) =>
                          void patchJustification(c, {
                            financiamentoExterno: v as SimBlank,
                          })
                        }
                      />
                    </td>
                    <td>
                      <ThemeDateField
                        value={c.justification?.previsaoFat ?? null}
                        onChange={(previsaoFat) => void patchJustification(c, { previsaoFat })}
                      />
                    </td>
                    <td className="ct-just-col">
                      <textarea
                        className="ct-textarea"
                        value={c.justification?.justificativa ?? ''}
                        onChange={(e) =>
                          void patchJustification(c, { justificativa: e.target.value })
                        }
                        rows={2}
                      />
                    </td>
                    <td>
                      {c.brokenPromise && (
                        <span className="ct-badge ct-badge--broken">{c.brokenPromiseLabel}</span>
                      )}
                      {!c.justification?.previsaoFat && !c.brokenPromise && (
                        <span className="ct-badge ct-badge--pend">SEM PREVISÃO</span>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleJust.length === 0 && (
                  <tr>
                    <td colSpan={9}>Nenhum contrato no filtro atual.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {area === 'fechamento' && (
        <section className="ct-panel">
          <article className="ct-store-card ct-regional">
            <div className="ct-toolbar">
              <h3 style={{ margin: 0 }}>REGIONAL</h3>
              <span className={`ct-badge ${regional.parcial ? 'ct-badge--pend' : 'ct-badge--ok'}`}>
                {regional.label}
              </span>
            </div>
            <div className="ct-kpi-grid">
              <Kpi label="Contratos" value={formatInt(regional.contratosAbertos)} auto />
              <Kpi label="Consórcios" value={formatInt(regional.consorcios)} auto />
              <Kpi label="Financ. ext." value={formatInt(regional.financiamentosExternos)} auto />
              <Kpi label="Fat. hoje" value={formatInt(regional.fatHoje)} auto />
              <Kpi label="Fat. D+1" value={formatInt(regional.fatD1)} auto />
              <Kpi label="Fat. D+2" value={formatInt(regional.fatD2)} auto />
              <Kpi label="Fat. D+3" value={formatInt(regional.fatD3)} auto />
              <Kpi label="Restante mês" value={formatInt(regional.fatRestanteMes)} auto />
              <Kpi label="Próx. mês" value={formatInt(regional.fatProximoMes)} auto />
              <Kpi label="Sem previsão" value={formatInt(regional.semPrevisao)} auto />
              <Kpi label="Descumpridas" value={formatInt(regional.previsoesDescumpridas)} auto />
              <Kpi label="Meta" value={formatInt(regional.metaMensal)} auto />
              <Kpi label="Meta desafio" value={formatInt(regional.metaDesafio)} auto />
              <Kpi label="Proj. vendas" value={formatInt(regional.projecaoVendas)} auto />
              <Kpi label="Proj. fat." value={formatInt(regional.projecaoFaturamento)} auto />
              <Kpi
                label="% meta"
                value={formatPct(regional.pctMeta, { alreadyPercent: true })}
                auto
                tone={attainmentTone(regional.pctMeta)}
              />
              <Kpi
                label="% desafio"
                value={formatPct(regional.pctMetaDesafio, { alreadyPercent: true })}
                auto
                tone={attainmentTone(regional.pctMetaDesafio)}
              />
              <Kpi label="VNF proj." value={formatInt(regional.vnfProjetado)} auto />
              <Kpi
                label="% VNF/meta"
                value={formatPct(regional.pctVnfMeta, { alreadyPercent: true })}
                auto
              />
              <Kpi
                label="GAP meta"
                value={formatInt(regional.gapMeta)}
                auto
                tone={gapTone(regional.gapMeta)}
              />
              <Kpi
                label="GAP desafio"
                value={formatInt(regional.gapMetaDesafio)}
                auto
                tone={gapTone(regional.gapMetaDesafio)}
              />
            </div>
          </article>

          <div className="ct-grid-stores">
            {storeViews.map((view) => {
              const closing = closingMap[view.sigla] ?? emptyClosing(view.sigla)
              const confClass =
                view.conferencia === 'OK'
                  ? 'ct-badge--ok'
                  : view.conferencia === 'DIVERGENCIA'
                    ? 'ct-badge--div'
                    : 'ct-badge--pend'
              return (
                <article key={view.sigla} className="ct-store-card">
                  <div className="ct-toolbar">
                    <h3>
                      {view.sigla} · {lojaNome(view.sigla)}
                    </h3>
                    <span className={`ct-badge ${confClass}`}>{view.conferencia}</span>
                  </div>

                  <div className="ct-edit-row">
                    <label>
                      Meta mensal
                      <input
                        className="ct-input"
                        type="number"
                        value={closing.metaMensal ?? ''}
                        onChange={(e) =>
                          void patchClosing(view.sigla, {
                            metaMensal: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Meta desafio
                      <input
                        className="ct-input"
                        type="number"
                        value={closing.metaDesafio ?? ''}
                        onChange={(e) =>
                          void patchClosing(view.sigla, {
                            metaDesafio: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Vendas acum.
                      <input
                        className="ct-input"
                        type="number"
                        value={closing.vendasAcumuladas ?? ''}
                        onChange={(e) =>
                          void patchClosing(view.sigla, {
                            vendasAcumuladas:
                              e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Fat. acum.
                      <input
                        className="ct-input"
                        type="number"
                        value={closing.faturamentoAcumulado ?? ''}
                        onChange={(e) =>
                          void patchClosing(view.sigla, {
                            faturamentoAcumulado:
                              e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      V+F hoje
                      <input
                        className="ct-input"
                        type="number"
                        value={closing.vf[todayIso()] ?? ''}
                        onChange={(e) => {
                          const n = e.target.value === '' ? 0 : Number(e.target.value)
                          const vf = { ...closing.vf }
                          if (!n) delete vf[todayIso()]
                          else vf[todayIso()] = n
                          void patchClosing(view.sigla, { vf })
                        }}
                      />
                    </label>
                  </div>

                  <div className="ct-kpi-grid">
                    <Kpi label="Abertos" value={formatInt(view.contratosAbertos)} auto />
                    <Kpi label="Consórcios" value={formatInt(view.consorcios)} auto />
                    <Kpi label="Financ. ext." value={formatInt(view.financiamentosExternos)} auto />
                    <Kpi label="Fat. hoje" value={formatInt(view.fatHoje)} auto />
                    <Kpi label="Fat. D+1" value={formatInt(view.fatD1)} auto />
                    <Kpi label="Fat. D+2" value={formatInt(view.fatD2)} auto />
                    <Kpi label="Fat. D+3" value={formatInt(view.fatD3)} auto />
                    <Kpi label="Restante mês" value={formatInt(view.fatRestanteMes)} auto />
                    <Kpi label="Próx. mês" value={formatInt(view.fatProximoMes)} auto />
                    <Kpi label="C/ previsão mês" value={formatInt(view.totalComPrevisaoMes)} auto />
                    <Kpi label="Sem previsão" value={formatInt(view.semPrevisao)} auto />
                    <Kpi label="Descumpridas" value={formatInt(view.previsoesDescumpridas)} auto />
                    <Kpi
                      label="Proj. vendas"
                      value={view.projecaoValida ? formatInt(view.projecaoVendas) : '—'}
                      auto
                    />
                    <Kpi
                      label="Proj. fat."
                      value={view.projecaoValida ? formatInt(view.projecaoFaturamento) : '—'}
                      auto
                    />
                    <Kpi
                      label="% meta"
                      value={
                        view.projecaoValida
                          ? formatPct(view.pctMeta, { alreadyPercent: true })
                          : '—'
                      }
                      auto
                      tone={attainmentTone(view.pctMeta)}
                    />
                    <Kpi
                      label="% desafio"
                      value={
                        view.projecaoValida
                          ? formatPct(view.pctMetaDesafio, { alreadyPercent: true })
                          : '—'
                      }
                      auto
                      tone={attainmentTone(view.pctMetaDesafio)}
                    />
                    <Kpi label="VNF atual" value={formatInt(view.vnfAtual)} auto />
                    <Kpi
                      label="VNF proj."
                      value={view.projecaoValida ? formatInt(view.vnfProjetado) : '—'}
                      auto
                    />
                    <Kpi
                      label="% VNF/meta"
                      value={
                        view.projecaoValida
                          ? formatPct(view.pctVnfMeta, { alreadyPercent: true })
                          : '—'
                      }
                      auto
                    />
                    <Kpi
                      label="GAP meta"
                      value={view.projecaoValida ? formatInt(view.gapMeta) : '—'}
                      auto
                      tone={gapTone(view.gapMeta)}
                    />
                    <Kpi
                      label="GAP desafio"
                      value={view.projecaoValida ? formatInt(view.gapMetaDesafio) : '—'}
                      auto
                      tone={gapTone(view.gapMetaDesafio)}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function Kpi(props: {
  label: string
  value: string
  auto?: boolean
  tone?: 'ok' | 'warn' | 'bad' | 'neutral'
}) {
  const toneClass =
    props.tone === 'ok'
      ? 'ct-tone-ok'
      : props.tone === 'warn'
        ? 'ct-tone-warn'
        : props.tone === 'bad'
          ? 'ct-tone-bad'
          : ''
  return (
    <div className={`ct-kpi ${props.auto ? 'is-auto' : 'is-edit'}`}>
      <span>{props.label}</span>
      <strong className={toneClass}>{props.value}</strong>
    </div>
  )
}

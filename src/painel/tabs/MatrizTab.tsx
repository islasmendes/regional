import { useEffect, useMemo, useState } from 'react'
import { listStoreKpis, subscribeStoreKpis } from '../../firebase/kpis'
import {
  cellForKpi,
  cellForSub,
  formatMatrixNumber,
  formatPct,
  recentMonthKeys,
  subscribeMonthCheckTotals,
  subscribeMonthMetasTree,
  subscribeMonthResults,
  type MatrixCellView,
  type MatrixMetaTree,
  type MonthCheckTotals,
  type MonthResultOverride,
} from '../../firebase/matrix'
import { currentMonthKey } from '../../firebase/metas'
import type { StoreKpi, StoreMeta } from '../../firebase/types'
import { INDICATOR_KIND_SHORT } from '../../firebase/types'
import { ThemeSelect } from '../../ui/ThemeSelect'

type Props = {
  stores: StoreMeta[]
}

type StoreMatrixData = {
  metas: MatrixMetaTree
  checks: MonthCheckTotals
  overrides: MonthResultOverride
}

function CellStack({ cell }: { cell: MatrixCellView }) {
  if (cell.kind === 'conversao') {
    return (
      <div className="matriz-cell matriz-cell--conversao">
        <span className="matriz-cell-label">Conv.</span>
        <strong>{formatPct(cell.conversaoPct)}</strong>
      </div>
    )
  }
  if (cell.kind === 'alvo') {
    return (
      <div className="matriz-cell matriz-cell--alvo">
        <div>
          <span className="matriz-cell-label">Alvo</span>
          <strong>{formatMatrixNumber(cell.meta)}</strong>
        </div>
        <div>
          <span className="matriz-cell-label">Real</span>
          <strong>{formatMatrixNumber(cell.real)}</strong>
        </div>
      </div>
    )
  }
  return (
    <div className="matriz-cell matriz-cell--volume">
      <div>
        <span className="matriz-cell-label">Meta</span>
        <strong>{formatMatrixNumber(cell.meta)}</strong>
      </div>
      <div>
        <span className="matriz-cell-label">Real</span>
        <strong className={cell.source === 'override' ? 'is-override' : ''}>
          {formatMatrixNumber(cell.real)}
        </strong>
      </div>
      <div>
        <span className="matriz-cell-label">Proj%</span>
        <strong>{formatPct(cell.projPct)}</strong>
      </div>
    </div>
  )
}

export function MatrizTab({ stores }: Props) {
  const monthOptions = useMemo(() => recentMonthKeys(8), [])
  const [monthKey, setMonthKey] = useState(() => currentMonthKey())
  const [columns, setColumns] = useState<StoreKpi[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [byStore, setByStore] = useState<Record<string, StoreMatrixData>>({})

  const activeStores = useMemo(
    () => stores.filter((s) => s.active !== false),
    [stores],
  )
  const catalogSigla = activeStores[0]?.code ?? stores[0]?.code ?? ''

  useEffect(() => {
    if (!catalogSigla) {
      setColumns([])
      return
    }
    return subscribeStoreKpis(catalogSigla, (kpis) => {
      setColumns(kpis.filter((k) => k.ativo !== false))
    })
  }, [catalogSigla])

  // Se a primeira loja ainda não tem KPIs, tenta achar um catálogo em outra.
  useEffect(() => {
    if (!catalogSigla || columns.length > 0) return
    let cancelled = false
    void (async () => {
      for (const store of activeStores) {
        if (store.code === catalogSigla) continue
        const list = await listStoreKpis(store.code)
        const active = list.filter((k) => k.ativo !== false)
        if (active.length > 0 && !cancelled) {
          setColumns(active)
          break
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeStores, catalogSigla, columns.length])

  useEffect(() => {
    if (activeStores.length === 0) {
      setByStore({})
      return
    }
    const local: Record<string, StoreMatrixData> = {}
    const unsubs: Array<() => void> = []

    for (const store of activeStores) {
      local[store.code] = { metas: {}, checks: {}, overrides: {} }
      const code = store.code
      unsubs.push(
        subscribeMonthMetasTree(code, monthKey, (metas) => {
          setByStore((prev) => ({
            ...prev,
            [code]: { ...(prev[code] ?? { metas: {}, checks: {}, overrides: {} }), metas },
          }))
        }),
      )
      unsubs.push(
        subscribeMonthCheckTotals(code, monthKey, (checks) => {
          setByStore((prev) => ({
            ...prev,
            [code]: { ...(prev[code] ?? { metas: {}, checks: {}, overrides: {} }), checks },
          }))
        }),
      )
      unsubs.push(
        subscribeMonthResults(code, monthKey, (overrides) => {
          setByStore((prev) => ({
            ...prev,
            [code]: {
              ...(prev[code] ?? { metas: {}, checks: {}, overrides: {} }),
              overrides,
            },
          }))
        }),
      )
    }

    setByStore(local)
    return () => {
      for (const u of unsubs) u()
    }
  }, [activeStores, monthKey])

  const toggleKpi = (kpiId: string) => {
    setExpanded((prev) => ({ ...prev, [kpiId]: !prev[kpiId] }))
  }

  if (stores.length === 0) {
    return (
      <div className="painel-tab">
        <header className="painel-tab-head">
          <h2>Matriz</h2>
          <p>Cadastre lojas e KPIs para montar a matriz.</p>
        </header>
        <section className="painel-panel">
          <p className="painel-muted">Nenhuma loja ainda.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="painel-tab">
      <header className="painel-tab-head">
        <h2>Matriz</h2>
        <p>
          Linhas = lojas · colunas = KPIs. Volume: Meta · Real · Proj%. Conversão: cálculo A÷B.
          Alvo: Alvo · Real. Real vem do check-out (override do painel manda quando existir).
        </p>
      </header>

      <section className="painel-panel matriz-toolbar">
        <ThemeSelect
          label="Mês"
          value={monthKey}
          onChange={setMonthKey}
          options={monthOptions.map((key) => ({ value: key, label: key }))}
        />
        <p className="painel-hint">
          Catálogo de colunas: {catalogSigla || '—'} · {columns.length} KPI(s) ·{' '}
          {activeStores.length} loja(s)
        </p>
      </section>

      {columns.length === 0 ? (
        <section className="painel-panel">
          <p className="painel-muted">Nenhum KPI ativo. Cadastre na aba KPIs (escopo TODOS).</p>
        </section>
      ) : (
        <section className="painel-panel matriz-wrap">
          <div className="matriz-scroll">
            <table className="matriz-table">
              <thead>
                <tr>
                  <th className="matriz-sticky">Loja</th>
                  {columns.map((kpi) => {
                    const open = !!expanded[kpi.id]
                    const subCount = (kpi.subs ?? []).filter((s) => s.ativo !== false).length
                    return (
                      <th key={kpi.id} style={{ ['--kpi' as string]: kpi.cor }}>
                        <button
                          type="button"
                          className="matriz-kpi-head"
                          onClick={() => toggleKpi(kpi.id)}
                          disabled={subCount === 0}
                          title={subCount ? 'Expandir subindicadores' : undefined}
                        >
                          <span className="matriz-kpi-dot" aria-hidden />
                          <span>
                            <strong>{kpi.nome}</strong>
                            <small>
                              {INDICATOR_KIND_SHORT[kpi.kind]}
                              {subCount > 0 ? ` · ${open ? '−' : '+'} ${subCount}` : ''}
                            </small>
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
                {/* sub headers when expanded */}
                {columns.some((k) => expanded[k.id]) && (
                  <tr className="matriz-subhead-row">
                    <th className="matriz-sticky">Subs</th>
                    {columns.map((kpi) => {
                      const open = !!expanded[kpi.id]
                      const subs = (kpi.subs ?? []).filter((s) => s.ativo !== false)
                      if (!open || subs.length === 0) {
                        return <th key={`${kpi.id}-empty`} />
                      }
                      return (
                        <th key={`${kpi.id}-subs`}>
                          <div className="matriz-subhead-list">
                            {subs.map((sub) => (
                              <span key={sub.id}>{sub.nome}</span>
                            ))}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                )}
              </thead>
              <tbody>
                {activeStores.map((store) => {
                  const data = byStore[store.code] ?? {
                    metas: {},
                    checks: {},
                    overrides: {},
                  }
                  return (
                    <tr key={store.code}>
                      <th className="matriz-sticky matriz-loja">{store.code}</th>
                      {columns.map((kpi) => {
                        const cell = cellForKpi({
                          kpi,
                          monthKey,
                          metas: data.metas,
                          checks: data.checks,
                          overrides: data.overrides,
                        })
                        const open = !!expanded[kpi.id]
                        const subs = (kpi.subs ?? []).filter((s) => s.ativo !== false)
                        return (
                          <td key={kpi.id}>
                            <CellStack cell={cell} />
                            {open && subs.length > 0 && (
                              <div className="matriz-sub-cells">
                                {subs.map((sub) => (
                                  <div key={sub.id} className="matriz-sub-block">
                                    <span className="matriz-sub-name">{sub.nome}</span>
                                    <CellStack
                                      cell={cellForSub({
                                        parent: kpi,
                                        sub,
                                        monthKey,
                                        metas: data.metas,
                                        checks: data.checks,
                                        overrides: data.overrides,
                                      })}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

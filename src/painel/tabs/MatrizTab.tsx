import { useEffect, useMemo, useState } from 'react'
import { listStoreKpis, subscribeStoreKpis } from '../../firebase/kpis'
import {
  asFiniteNumber,
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
import { currentMonthKey, saveKpiMonthMeta, saveSubMonthMeta } from '../../firebase/metas'
import { saveKpiMonthResult, saveSubMonthResult } from '../../firebase/results'
import type { StoreKpi, StoreMeta } from '../../firebase/types'
import { INDICATOR_KIND_SHORT, needsMonthMeta } from '../../firebase/types'
import { ThemeSelect } from '../../ui/ThemeSelect'

type Props = {
  stores: StoreMeta[]
}

type StoreMatrixData = {
  metas: MatrixMetaTree
  checks: MonthCheckTotals
  overrides: MonthResultOverride
}

type LayoutMode = 'lado' | 'baixo'

type EditorTarget =
  | { mode: 'one'; sigla: string }
  | { mode: 'all'; sigla: string }

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
        <div className="matriz-metric">
          <span className="matriz-cell-label">Alvo</span>
          <strong className="matriz-meta-value">{formatMatrixNumber(cell.meta)}</strong>
        </div>
        <div className="matriz-metric">
          <span className="matriz-cell-label">Real</span>
          <strong>{formatMatrixNumber(cell.real)}</strong>
        </div>
      </div>
    )
  }
  return (
    <div className="matriz-cell matriz-cell--volume">
      <div className="matriz-metric">
        <span className="matriz-cell-label">Meta</span>
        <strong className="matriz-meta-value">{formatMatrixNumber(cell.meta)}</strong>
      </div>
      <div className="matriz-metric">
        <span className="matriz-cell-label">Real</span>
        <strong className={cell.source === 'override' ? 'is-override' : ''}>
          {formatMatrixNumber(cell.real)}
        </strong>
      </div>
      <div className="matriz-metric">
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
  const [layout, setLayout] = useState<LayoutMode>('lado')
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [metaDrafts, setMetaDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  const openEditor = (target: EditorTarget) => {
    const data = byStore[target.sigla] ?? { metas: {}, checks: {}, overrides: {} }
    const nextDrafts: Record<string, string> = {}
    const nextMetas: Record<string, string> = {}
    for (const kpi of columns) {
      if (kpi.kind === 'conversao') continue
      const cell = cellForKpi({
        kpi,
        monthKey,
        metas: data.metas,
        checks: data.checks,
        overrides: data.overrides,
      })
      nextDrafts[kpi.id] = cell.real != null ? String(cell.real) : ''
      nextMetas[kpi.id] = cell.meta != null ? String(cell.meta) : ''
      for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false)) {
        if (sub.kind === 'conversao') continue
        const subCell = cellForSub({
          parent: kpi,
          sub,
          monthKey,
          metas: data.metas,
          checks: data.checks,
          overrides: data.overrides,
        })
        const key = `${kpi.id}::${sub.id}`
        nextDrafts[key] = subCell.real != null ? String(subCell.real) : ''
        nextMetas[key] = subCell.meta != null ? String(subCell.meta) : ''
      }
    }
    setDrafts(nextDrafts)
    setMetaDrafts(nextMetas)
    setMessage(null)
    setEditor(target)
  }

  const saveEditor = async () => {
    if (!editor) return
    const targets =
      editor.mode === 'all' ? activeStores.map((s) => s.code) : [editor.sigla]
    setBusy(true)
    setMessage(null)
    try {
      for (const sigla of targets) {
        for (const kpi of columns) {
          if (kpi.kind === 'conversao') continue
          const metaRaw = metaDrafts[kpi.id]
          if (needsMonthMeta(kpi.kind) && metaRaw != null && metaRaw.trim() !== '') {
            const meta = asFiniteNumber(metaRaw)
            if (meta == null) throw new Error(`Meta inválida em ${kpi.nome}.`)
            await saveKpiMonthMeta({ sigla, monthKey, kpiId: kpi.id, valor: meta })
          }
          const realRaw = drafts[kpi.id]
          if (realRaw != null && realRaw.trim() !== '') {
            const real = asFiniteNumber(realRaw)
            if (real == null) throw new Error(`Real inválido em ${kpi.nome}.`)
            await saveKpiMonthResult({ sigla, monthKey, kpiId: kpi.id, valor: real })
          }
          for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false)) {
            if (sub.kind === 'conversao') continue
            const key = `${kpi.id}::${sub.id}`
            const subMetaRaw = metaDrafts[key]
            if (needsMonthMeta(sub.kind) && subMetaRaw != null && subMetaRaw.trim() !== '') {
              const meta = asFiniteNumber(subMetaRaw)
              if (meta == null) throw new Error(`Meta inválida em ${sub.nome}.`)
              await saveSubMonthMeta({
                sigla,
                monthKey,
                kpiId: kpi.id,
                subId: sub.id,
                valor: meta,
              })
            }
            const subRealRaw = drafts[key]
            if (subRealRaw != null && subRealRaw.trim() !== '') {
              const real = asFiniteNumber(subRealRaw)
              if (real == null) throw new Error(`Real inválido em ${sub.nome}.`)
              await saveSubMonthResult({
                sigla,
                monthKey,
                kpiId: kpi.id,
                subId: sub.id,
                valor: real,
              })
            }
          }
        }
      }
      setMessage(
        editor.mode === 'all'
          ? `Reais/metas salvos em ${targets.length} loja(s) · ${monthKey}.`
          : `Reais/metas salvos em ${editor.sigla} · ${monthKey}.`,
      )
      setEditor(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar resultados.')
    } finally {
      setBusy(false)
    }
  }

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

  const renderStoreCells = (sigla: string) => {
    const data = byStore[sigla] ?? { metas: {}, checks: {}, overrides: {} }
    return columns.map((kpi) => {
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
        <div key={kpi.id} className="matriz-kpi-block">
          <div className="matriz-kpi-block-head">
            <span className="matriz-kpi-dot" style={{ background: kpi.cor }} aria-hidden />
            <div>
              <strong>{kpi.nome}</strong>
              <small>{INDICATOR_KIND_SHORT[kpi.kind]}</small>
            </div>
          </div>
          <CellStack cell={cell} />
          {open &&
            subs.map((sub) => (
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
      )
    })
  }

  return (
    <div className="painel-tab">
      <header className="painel-tab-head">
        <h2>Matriz</h2>
        <p>
          Clique na <strong>sigla</strong> para lançar Real (e Meta/Alvo). Real do painel sobrescreve
          o check-out. Use o layout Lado/Baixo conforme a tela.
        </p>
      </header>

      <section className="painel-panel matriz-toolbar">
        <div className="matriz-toolbar-row">
          <ThemeSelect
            label="Mês"
            value={monthKey}
            onChange={setMonthKey}
            options={monthOptions.map((key) => ({ value: key, label: key }))}
          />
          <div className="matriz-layout-toggle" role="group" aria-label="Orientação da matriz">
            <span className="ui-field-label">Tab</span>
            <div className="matriz-layout-btns">
              <button
                type="button"
                className={`painel-btn ${layout === 'lado' ? 'painel-btn--primary' : 'painel-btn--ghost'}`}
                onClick={() => setLayout('lado')}
              >
                Lado
              </button>
              <button
                type="button"
                className={`painel-btn ${layout === 'baixo' ? 'painel-btn--primary' : 'painel-btn--ghost'}`}
                onClick={() => setLayout('baixo')}
              >
                Baixo
              </button>
            </div>
          </div>
        </div>
        <div className="painel-store-actions">
          <button
            type="button"
            className="painel-btn painel-btn--primary"
            disabled={activeStores.length === 0 || columns.length === 0}
            onClick={() =>
              openEditor({
                mode: 'all',
                sigla: activeStores[0]?.code ?? catalogSigla,
              })
            }
          >
            Atualizar todas
          </button>
        </div>
        <p className="painel-hint">
          Mês <strong>{monthKey}</strong> · catálogo {catalogSigla || '—'} · {columns.length} KPI(s)
          · {activeStores.length} loja(s)
        </p>
        {message && <p className="painel-toast">{message}</p>}
      </section>

      {columns.length === 0 ? (
        <section className="painel-panel">
          <p className="painel-muted">Nenhum KPI ativo. Cadastre na aba KPIs (escopo TODOS).</p>
        </section>
      ) : layout === 'baixo' ? (
        <div className="matriz-stack">
          {activeStores.map((store) => (
            <section key={store.code} className="painel-panel matriz-store-card">
              <div className="matriz-store-card-head">
                <button
                  type="button"
                  className="matriz-sigla-btn"
                  onClick={() => openEditor({ mode: 'one', sigla: store.code })}
                >
                  {store.code}
                </button>
                <button
                  type="button"
                  className="painel-btn painel-btn--ghost"
                  onClick={() => openEditor({ mode: 'one', sigla: store.code })}
                >
                  Lançar real
                </button>
              </div>
              <div className="matriz-stack-kpis">{renderStoreCells(store.code)}</div>
            </section>
          ))}
        </div>
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
                      <th className="matriz-sticky">
                        <button
                          type="button"
                          className="matriz-sigla-btn"
                          onClick={() => openEditor({ mode: 'one', sigla: store.code })}
                          title="Lançar resultados desta loja"
                        >
                          {store.code}
                        </button>
                      </th>
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

      {editor && (
        <div className="matriz-editor-backdrop" role="presentation" onClick={() => setEditor(null)}>
          <section
            className="matriz-editor"
            role="dialog"
            aria-modal="true"
            aria-label="Lançar resultados"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="matriz-editor-head">
              <div>
                <p className="painel-eyebrow">Resultados · {monthKey}</p>
                <h3>
                  {editor.mode === 'all'
                    ? `Atualizar todas (${activeStores.length})`
                    : editor.sigla}
                </h3>
              </div>
              <button
                type="button"
                className="painel-btn painel-btn--ghost"
                onClick={() => setEditor(null)}
              >
                Fechar
              </button>
            </header>

            {editor.mode === 'all' && (
              <ThemeSelect
                label="Pré-visualizar valores de"
                value={editor.sigla}
                onChange={(sigla) => openEditor({ mode: 'all', sigla })}
                options={activeStores.map((s) => ({ value: s.code, label: s.code }))}
              />
            )}

            <p className="painel-hint">
              Preencha <strong>Meta/Alvo</strong> e <strong>Real</strong>. Real grava em{' '}
              <code>results/{monthKey}</code> e sobrescreve o checkout na matriz.
              {editor.mode === 'all' ? ' Ao salvar, replica os mesmos valores em todas as lojas.' : ''}
            </p>

            <div className="matriz-editor-list">
              {columns
                .filter((k) => k.kind !== 'conversao')
                .map((kpi) => (
                  <div key={kpi.id} className="matriz-editor-item">
                    <div className="matriz-editor-item-title">
                      <span className="matriz-kpi-dot" style={{ background: kpi.cor }} aria-hidden />
                      <strong>{kpi.nome}</strong>
                      <small>{INDICATOR_KIND_SHORT[kpi.kind]}</small>
                    </div>
                    <div className="painel-form--row">
                      {needsMonthMeta(kpi.kind) && (
                        <label>
                          {kpi.kind === 'alvo' ? 'Alvo' : 'Meta'}
                          <input
                            value={metaDrafts[kpi.id] ?? ''}
                            onChange={(e) =>
                              setMetaDrafts((d) => ({ ...d, [kpi.id]: e.target.value }))
                            }
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </label>
                      )}
                      <label>
                        Real
                        <input
                          value={drafts[kpi.id] ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [kpi.id]: e.target.value }))}
                          inputMode="decimal"
                          placeholder="0"
                        />
                      </label>
                    </div>
                    {(kpi.subs ?? [])
                      .filter((s) => s.ativo !== false && s.kind !== 'conversao')
                      .map((sub) => {
                        const key = `${kpi.id}::${sub.id}`
                        return (
                          <div key={sub.id} className="matriz-editor-sub">
                            <strong>{sub.nome}</strong>
                            <div className="painel-form--row">
                              {needsMonthMeta(sub.kind) && (
                                <label>
                                  {sub.kind === 'alvo' ? 'Alvo' : 'Meta'}
                                  <input
                                    value={metaDrafts[key] ?? ''}
                                    onChange={(e) =>
                                      setMetaDrafts((d) => ({ ...d, [key]: e.target.value }))
                                    }
                                    inputMode="decimal"
                                  />
                                </label>
                              )}
                              <label>
                                Real
                                <input
                                  value={drafts[key] ?? ''}
                                  onChange={(e) =>
                                    setDrafts((d) => ({ ...d, [key]: e.target.value }))
                                  }
                                  inputMode="decimal"
                                />
                              </label>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                ))}
            </div>

            <div className="painel-store-actions">
              <button
                type="button"
                className="painel-btn painel-btn--primary"
                disabled={busy}
                onClick={() => void saveEditor()}
              >
                {busy ? 'Salvando…' : editor.mode === 'all' ? 'Salvar em todas' : 'Salvar loja'}
              </button>
              <button
                type="button"
                className="painel-btn painel-btn--ghost"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

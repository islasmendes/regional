import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { listStoreKpis, subscribeStoreKpis } from '../../firebase/kpis'
import {
  asFiniteNumber,
  cellForKpi,
  cellForSub,
  formatMatrixNumber,
  formatPct,
  projTone,
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
import type { AlvoUnidade, StoreKpi, StoreMeta } from '../../firebase/types'
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

type TabNavMode = 'lado' | 'baixo'
type SortMetric = 'az' | 'meta' | 'real' | 'proj'

type EditorTarget =
  | { mode: 'one'; sigla: string }
  | { mode: 'bulk' }

type EditorField = {
  fieldId: string
  kind: 'meta' | 'real'
  group: string
  sigla?: string
  col?: string
}

function draftKey(sigla: string, indicatorKey: string): string {
  return `${sigla}::${indicatorKey}`
}

function formatAlvoValue(value: number | null, unidade: AlvoUnidade | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (unidade === 'percent') return formatPct(value)
  return formatMatrixNumber(value)
}

function CellStack({
  cell,
  alvoUnidade,
}: {
  cell: MatrixCellView
  alvoUnidade?: AlvoUnidade | null
}) {
  if (cell.kind === 'conversao') {
    const tone = projTone(cell.conversaoPct)
    return (
      <div className="matriz-cell matriz-cell--conversao">
        <span className="matriz-cell-label">Conv.</span>
        <strong className={`matriz-proj is-${tone}`}>{formatPct(cell.conversaoPct)}</strong>
      </div>
    )
  }
  if (cell.kind === 'alvo') {
    return (
      <div className="matriz-cell matriz-cell--alvo">
        <div className="matriz-metric">
          <span className="matriz-cell-label">Alvo</span>
          <strong className="matriz-meta-value">{formatAlvoValue(cell.meta, alvoUnidade)}</strong>
        </div>
        <div className="matriz-metric">
          <span className="matriz-cell-label">Real</span>
          <strong>{formatAlvoValue(cell.real, alvoUnidade)}</strong>
        </div>
      </div>
    )
  }
  const tone = projTone(cell.projPct)
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
        <strong className={`matriz-proj is-${tone}`}>{formatPct(cell.projPct)}</strong>
      </div>
    </div>
  )
}

function defaultMetricForKind(kind: StoreKpi['kind']): Exclude<SortMetric, 'az'> {
  if (kind === 'conversao') return 'proj'
  if (kind === 'alvo') return 'meta'
  return 'real'
}

function sortMetricLabel(metric: SortMetric, kind: StoreKpi['kind']): string {
  if (metric === 'az') return 'A–Z'
  if (metric === 'meta') return kind === 'alvo' ? 'Alvo' : 'Meta'
  if (metric === 'real') return 'Real'
  return kind === 'conversao' ? 'Conv%' : 'Proj%'
}

function metricsForKind(kind: StoreKpi['kind']): Array<Exclude<SortMetric, 'az'>> {
  if (kind === 'conversao') return ['proj']
  if (kind === 'alvo') return ['meta', 'real']
  return ['meta', 'real', 'proj']
}

export function MatrizTab({ stores }: Props) {
  const monthOptions = useMemo(() => recentMonthKeys(8), [])
  const [monthKey, setMonthKey] = useState(() => currentMonthKey())
  const [columns, setColumns] = useState<StoreKpi[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [byStore, setByStore] = useState<Record<string, StoreMatrixData>>({})
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [tabNav, setTabNav] = useState<TabNavMode>('lado')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [metaDrafts, setMetaDrafts] = useState<Record<string, string>>({})
  const [bulkExpanded, setBulkExpanded] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /** null = todas; Set = subset visível (flags/cards). */
  const [storeFilter, setStoreFilter] = useState<Set<string> | null>(null)
  const [sortMetric, setSortMetric] = useState<SortMetric>('az')
  const [sortKpiId, setSortKpiId] = useState('')
  const editorFieldRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const activeStores = useMemo(
    () => stores.filter((s) => s.active !== false),
    [stores],
  )
  const catalogSigla = activeStores[0]?.code ?? stores[0]?.code ?? ''

  const editableColumns = useMemo(
    () => columns.filter((k) => k.kind !== 'conversao'),
    [columns],
  )

  const visibleStores = useMemo(() => {
    const filtered =
      storeFilter == null
        ? [...activeStores]
        : activeStores.filter((s) => storeFilter.has(s.code))

    if (sortMetric === 'az' || !sortKpiId) {
      return filtered.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
    }

    const sortKpi = columns.find((k) => k.id === sortKpiId)
    if (!sortKpi) {
      return filtered.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
    }

    const metricOf = (sigla: string): number => {
      const data = byStore[sigla] ?? { metas: {}, checks: {}, overrides: {} }
      const cell = cellForKpi({
        kpi: sortKpi,
        monthKey,
        metas: data.metas,
        checks: data.checks,
        overrides: data.overrides,
      })
      if (sortMetric === 'meta') return cell.meta ?? -Infinity
      if (sortMetric === 'real') return cell.real ?? -Infinity
      return cell.projPct ?? cell.conversaoPct ?? -Infinity
    }

    return filtered.sort((a, b) => {
      const diff = metricOf(b.code) - metricOf(a.code)
      if (diff !== 0) return diff
      return a.code.localeCompare(b.code, 'pt-BR')
    })
  }, [activeStores, storeFilter, sortMetric, sortKpiId, columns, byStore, monthKey])

  const bulkTargetStores = useMemo(
    () => (storeFilter == null ? activeStores : visibleStores),
    [storeFilter, activeStores, visibleStores],
  )

  const editorStores = useMemo(() => {
    if (!editor) return [] as StoreMeta[]
    if (editor.mode === 'bulk') return bulkTargetStores
    return activeStores.filter((s) => s.code === editor.sigla)
  }, [editor, bulkTargetStores, activeStores])

  const editorFields = useMemo((): EditorField[] => {
    if (!editor) return []
    const fields: EditorField[] = []
    for (const store of editorStores) {
      for (const kpi of editableColumns) {
        if (editor.mode === 'one' && needsMonthMeta(kpi.kind)) {
          fields.push({
            fieldId: `meta:${draftKey(store.code, kpi.id)}`,
            kind: 'meta',
            group: kpi.id,
            sigla: store.code,
            col: kpi.id,
          })
        }
        fields.push({
          fieldId: `real:${draftKey(store.code, kpi.id)}`,
          kind: 'real',
          group: kpi.id,
          sigla: store.code,
          col: kpi.id,
        })
        if (bulkExpanded[kpi.id]) {
          for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false && s.kind !== 'conversao')) {
            const key = `${kpi.id}::${sub.id}`
            if (editor.mode === 'one' && needsMonthMeta(sub.kind)) {
              fields.push({
                fieldId: `meta:${draftKey(store.code, key)}`,
                kind: 'meta',
                group: key,
                sigla: store.code,
                col: key,
              })
            }
            fields.push({
              fieldId: `real:${draftKey(store.code, key)}`,
              kind: 'real',
              group: key,
              sigla: store.code,
              col: key,
            })
          }
        }
      }
    }
    return fields
  }, [editor, editorStores, editableColumns, bulkExpanded])

  const editorTabOrder = useMemo(() => {
    if (tabNav === 'lado') return editorFields.map((f) => f.fieldId)

    const byCol = new Map<string, string[]>()
    for (const field of editorFields) {
      const col = `${field.kind}:${field.col ?? field.group}`
      const list = byCol.get(col) ?? []
      list.push(field.fieldId)
      byCol.set(col, list)
    }
    const ordered: string[] = []
    for (const kpi of editableColumns) {
      if (editor?.mode === 'one' && needsMonthMeta(kpi.kind)) {
        ordered.push(...(byCol.get(`meta:${kpi.id}`) ?? []))
      }
      ordered.push(...(byCol.get(`real:${kpi.id}`) ?? []))
      if (bulkExpanded[kpi.id]) {
        for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false && s.kind !== 'conversao')) {
          const key = `${kpi.id}::${sub.id}`
          if (editor?.mode === 'one' && needsMonthMeta(sub.kind)) {
            ordered.push(...(byCol.get(`meta:${key}`) ?? []))
          }
          ordered.push(...(byCol.get(`real:${key}`) ?? []))
        }
      }
    }
    return ordered
  }, [editor, editorFields, tabNav, editableColumns, bulkExpanded])

  const allSelected = storeFilter == null
  const toggleStoreFlag = (code: string) => {
    setStoreFilter((prev) => {
      if (prev == null) {
        return new Set([code])
      }
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
        if (next.size === 0) return null
        return next
      }
      next.add(code)
      if (next.size >= activeStores.length) return null
      return next
    })
  }
  const selectAllStores = () => setStoreFilter(null)
  const selectOnlyStore = (code: string) => setStoreFilter(new Set([code]))

  const sortByLoja = () => {
    setSortMetric('az')
    setSortKpiId('')
  }

  const sortByKpiMetric = (kpi: StoreKpi, metric: Exclude<SortMetric, 'az'>) => {
    if (sortKpiId === kpi.id && sortMetric === metric) {
      sortByLoja()
      return
    }
    setSortKpiId(kpi.id)
    setSortMetric(metric)
  }

  const sortByKpiName = (kpi: StoreKpi) => {
    const preferred = defaultMetricForKind(kpi.kind)
    if (sortKpiId === kpi.id && sortMetric === preferred) {
      const cycle = metricsForKind(kpi.kind)
      const idx = cycle.indexOf(preferred)
      const next = cycle[(idx + 1) % cycle.length]!
      if (next === preferred) {
        sortByLoja()
        return
      }
      setSortMetric(next)
      return
    }
    setSortKpiId(kpi.id)
    setSortMetric(preferred)
  }

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

  const parseDraftNumber = (raw: string | undefined, label: string): number | null => {
    if (raw == null) return null
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const value = asFiniteNumber(trimmed)
    if (value == null) throw new Error(`${label} inválido.`)
    return value
  }

  const openOneEditor = (sigla: string) => {
    const data = byStore[sigla] ?? { metas: {}, checks: {}, overrides: {} }
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
      nextDrafts[draftKey(sigla, kpi.id)] = cell.real != null ? String(cell.real) : ''
      nextMetas[draftKey(sigla, kpi.id)] = cell.meta != null ? String(cell.meta) : ''
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
        nextDrafts[draftKey(sigla, key)] = subCell.real != null ? String(subCell.real) : ''
        nextMetas[draftKey(sigla, key)] = subCell.meta != null ? String(subCell.meta) : ''
      }
    }
    setDrafts(nextDrafts)
    setMetaDrafts(nextMetas)
    setBulkExpanded({})
    setMessage(null)
    setEditor({ mode: 'one', sigla })
  }

  const openBulkRealEditor = () => {
    const nextDrafts: Record<string, string> = {}
    for (const store of bulkTargetStores) {
      const data = byStore[store.code] ?? { metas: {}, checks: {}, overrides: {} }
      for (const kpi of columns) {
        if (kpi.kind === 'conversao') continue
        const cell = cellForKpi({
          kpi,
          monthKey,
          metas: data.metas,
          checks: data.checks,
          overrides: data.overrides,
        })
        nextDrafts[draftKey(store.code, kpi.id)] = cell.real != null ? String(cell.real) : ''
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
          nextDrafts[draftKey(store.code, key)] =
            subCell.real != null ? String(subCell.real) : ''
        }
      }
    }
    setDrafts(nextDrafts)
    setMetaDrafts({})
    setBulkExpanded({})
    setMessage(null)
    setEditor({ mode: 'bulk' })
  }

  const saveEditor = async () => {
    if (!editor) return
    setBusy(true)
    setMessage(null)
    let wrote = 0
    try {
      for (const store of editorStores) {
        const sigla = store.code
        for (const kpi of columns) {
          if (kpi.kind === 'conversao') continue
          if (editor.mode === 'one' && needsMonthMeta(kpi.kind)) {
            const meta = parseDraftNumber(
              metaDrafts[draftKey(sigla, kpi.id)],
              `${sigla} · ${kpi.nome} (${kpi.kind === 'alvo' ? 'Alvo' : 'Meta'})`,
            )
            if (meta != null) {
              await saveKpiMonthMeta({ sigla, monthKey, kpiId: kpi.id, valor: meta })
              wrote += 1
            }
          }
          const real = parseDraftNumber(
            drafts[draftKey(sigla, kpi.id)],
            `${sigla} · ${kpi.nome} (Real)`,
          )
          if (real != null) {
            await saveKpiMonthResult({ sigla, monthKey, kpiId: kpi.id, valor: real })
            wrote += 1
          }
          for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false)) {
            if (sub.kind === 'conversao') continue
            const key = `${kpi.id}::${sub.id}`
            if (editor.mode === 'one' && needsMonthMeta(sub.kind)) {
              const meta = parseDraftNumber(
                metaDrafts[draftKey(sigla, key)],
                `${sigla} · ${sub.nome} (${sub.kind === 'alvo' ? 'Alvo' : 'Meta'})`,
              )
              if (meta != null) {
                await saveSubMonthMeta({
                  sigla,
                  monthKey,
                  kpiId: kpi.id,
                  subId: sub.id,
                  valor: meta,
                })
                wrote += 1
              }
            }
            const subReal = parseDraftNumber(
              drafts[draftKey(sigla, key)],
              `${sigla} · ${sub.nome} (Real)`,
            )
            if (subReal != null) {
              await saveSubMonthResult({
                sigla,
                monthKey,
                kpiId: kpi.id,
                subId: sub.id,
                valor: subReal,
              })
              wrote += 1
            }
          }
        }
      }
      if (wrote === 0) {
        throw new Error('Nenhum valor para salvar. Preencha Meta/Alvo ou Real.')
      }
      setMessage(
        editor.mode === 'bulk'
          ? `${wrote} real(is) salvos em ${editorStores.length} loja(s) · ${monthKey}.`
          : `${wrote} valor(es) salvos em ${editor.sigla} · ${monthKey}.`,
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

  const focusEditorField = (fieldId: string) => {
    const el = editorFieldRefs.current[fieldId]
    if (!el) return
    el.focus()
    el.select()
  }

  const onEditorFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>, fieldId: string) => {
    if (event.key !== 'Tab') return
    const order = editorTabOrder
    const index = order.indexOf(fieldId)
    if (index < 0 || order.length === 0) return
    event.preventDefault()
    const delta = event.shiftKey ? -1 : 1
    const nextIndex = (index + delta + order.length) % order.length
    focusEditorField(order[nextIndex]!)
  }

  const bindEditorField = (fieldId: string) => ({
    ref: (el: HTMLInputElement | null) => {
      editorFieldRefs.current[fieldId] = el
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => onEditorFieldKeyDown(event, fieldId),
  })

  if (stores.length === 0) {
    return (
      <div className="painel-tab">
        <section className="painel-panel">
          <p className="painel-muted">Cadastre lojas e KPIs para montar a matriz.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="painel-tab">
      <section className="painel-panel matriz-toolbar">
        <div className="matriz-store-flags" role="group" aria-label="Lojas">
          <button
            type="button"
            className={`matriz-store-flag ${allSelected ? 'is-on' : ''}`}
            onClick={selectAllStores}
          >
            <span className="matriz-store-flag-dot" aria-hidden />
            TODOS
          </button>
          {activeStores.map((store) => {
            const on = allSelected || !!storeFilter?.has(store.code)
            const only = storeFilter?.size === 1 && storeFilter.has(store.code)
            return (
              <button
                key={store.code}
                type="button"
                className={`matriz-store-flag ${on ? 'is-on' : ''} ${only ? 'is-solo' : ''}`}
                onClick={() => toggleStoreFlag(store.code)}
                onDoubleClick={() => selectOnlyStore(store.code)}
                title="Clique: incluir/excluir · Duplo clique: só esta"
              >
                <span className="matriz-store-flag-dot" aria-hidden />
                {store.code}
              </button>
            )
          })}
        </div>

        <div className="matriz-toolbar-row">
          <ThemeSelect
            label="Mês"
            value={monthKey}
            onChange={setMonthKey}
            options={monthOptions.map((key) => ({ value: key, label: key }))}
          />
        </div>
        <div className="painel-store-actions">
          <button
            type="button"
            className="painel-btn painel-btn--primary"
            disabled={bulkTargetStores.length === 0 || columns.length === 0}
            onClick={openBulkRealEditor}
          >
            {allSelected
              ? 'Lançar real · todas'
              : bulkTargetStores.length > 1
                ? `Lançar real (${bulkTargetStores.length})`
                : `Lançar real · ${bulkTargetStores[0]?.code ?? ''}`}
          </button>
        </div>
        {message && <p className="painel-toast">{message}</p>}
      </section>

      {columns.length === 0 ? (
        <section className="painel-panel">
          <p className="painel-muted">Nenhum KPI ativo. Cadastre na aba KPIs.</p>
        </section>
      ) : (
        <section className="painel-panel matriz-wrap">
          <div className="matriz-scroll">
            <table className="matriz-table">
              <thead>
                <tr>
                  <th className="matriz-sticky">
                    <button
                      type="button"
                      className={`matriz-sort-head ${sortMetric === 'az' ? 'is-active' : ''}`}
                      onClick={sortByLoja}
                      title="Ordenar lojas A–Z"
                    >
                      Loja
                      {sortMetric === 'az' && <span className="matriz-sort-mark">A–Z</span>}
                    </button>
                  </th>
                  {columns.map((kpi) => {
                    const open = !!expanded[kpi.id]
                    const subCount = (kpi.subs ?? []).filter((s) => s.ativo !== false).length
                    const active = sortKpiId === kpi.id && sortMetric !== 'az'
                    return (
                      <th key={kpi.id} style={{ ['--kpi' as string]: kpi.cor }}>
                        <div className="matriz-kpi-colhead">
                          <button
                            type="button"
                            className={`matriz-kpi-head ${active ? 'is-sorted' : ''}`}
                            onClick={() => sortByKpiName(kpi)}
                            title={`Ordenar por ${kpi.nome}`}
                          >
                            <span className="matriz-kpi-dot" aria-hidden />
                            <span>
                              <strong>{kpi.nome}</strong>
                              <small>
                                {INDICATOR_KIND_SHORT[kpi.kind]}
                                {active
                                  ? ` · ↓ ${sortMetricLabel(sortMetric, kpi.kind)}`
                                  : ''}
                              </small>
                            </span>
                          </button>
                          <div className="matriz-sort-chips" role="group" aria-label={`Ordenar ${kpi.nome}`}>
                            {metricsForKind(kpi.kind).map((metric) => (
                              <button
                                key={metric}
                                type="button"
                                className={`matriz-sort-chip ${
                                  active && sortMetric === metric ? 'is-on' : ''
                                }`}
                                onClick={() => sortByKpiMetric(kpi, metric)}
                              >
                                {sortMetricLabel(metric, kpi.kind)}
                              </button>
                            ))}
                            {subCount > 0 && (
                              <button
                                type="button"
                                className="matriz-sort-chip"
                                onClick={() => toggleKpi(kpi.id)}
                                title={open ? 'Recolher subs' : 'Expandir subs'}
                              >
                                {open ? '−' : '+'}
                                {subCount}
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleStores.map((store) => {
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
                          onClick={() => openOneEditor(store.code)}
                          title="Lançar meta e real desta loja"
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
                            <CellStack cell={cell} alvoUnidade={kpi.alvoUnidade} />
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
                                      alvoUnidade={sub.alvoUnidade}
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
            className="matriz-editor matriz-editor--bulk"
            role="dialog"
            aria-modal="true"
            aria-label="Lançar resultados"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="matriz-editor-head">
              <div>
                <p className="painel-eyebrow">
                  {editor.mode === 'bulk' ? 'Real acumulado' : 'Meta · Real'} · {monthKey}
                </p>
                <h3>
                  {editor.mode === 'bulk'
                    ? `Lançar real · ${editorStores.length} loja(s)`
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

            <div className="matriz-editor-controls">
              <div className="matriz-layout-toggle" role="group" aria-label="Navegação Tab nos campos">
                <span className="ui-field-label">Tab</span>
                <div className="matriz-layout-btns">
                  <button
                    type="button"
                    className={`painel-btn ${tabNav === 'lado' ? 'painel-btn--primary' : 'painel-btn--ghost'}`}
                    onClick={() => setTabNav('lado')}
                  >
                    Lado
                  </button>
                  <button
                    type="button"
                    className={`painel-btn ${tabNav === 'baixo' ? 'painel-btn--primary' : 'painel-btn--ghost'}`}
                    onClick={() => setTabNav('baixo')}
                  >
                    Baixo
                  </button>
                </div>
              </div>
            </div>

            <div className="matriz-bulk-wrap">
              <div className="matriz-bulk-scroll">
                <table className="matriz-bulk-table">
                  <thead>
                    <tr>
                      <th className="matriz-sticky">Loja</th>
                      {editableColumns.map((kpi) => {
                        const subCount = (kpi.subs ?? []).filter(
                          (s) => s.ativo !== false && s.kind !== 'conversao',
                        ).length
                        const open = !!bulkExpanded[kpi.id]
                        const metaLabel = kpi.kind === 'alvo' ? 'Alvo' : 'Meta'
                        return (
                          <th key={kpi.id} style={{ ['--kpi' as string]: kpi.cor }}>
                            <div className="matriz-bulk-colhead">
                              <span className="matriz-kpi-dot" aria-hidden />
                              <div>
                                <strong>{kpi.nome}</strong>
                                <small>
                                  {editor.mode === 'one' ? `${metaLabel} · Real` : 'Real'}
                                  {kpi.kind === 'alvo'
                                    ? kpi.alvoUnidade === 'absolute'
                                      ? ' · nº'
                                      : ' · %'
                                    : ''}
                                </small>
                              </div>
                              {subCount > 0 && (
                                <button
                                  type="button"
                                  className="matriz-sort-chip"
                                  onClick={() =>
                                    setBulkExpanded((prev) => ({
                                      ...prev,
                                      [kpi.id]: !prev[kpi.id],
                                    }))
                                  }
                                  title={open ? 'Recolher subs' : 'Expandir subs'}
                                >
                                  {open ? '−' : '+'}
                                  {subCount}
                                </button>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {editorStores.map((store) => (
                      <tr key={store.code}>
                        <th className="matriz-sticky">
                          <span className="matriz-bulk-sigla">{store.code}</span>
                        </th>
                        {editableColumns.map((kpi) => {
                          const open = !!bulkExpanded[kpi.id]
                          const key = draftKey(store.code, kpi.id)
                          const metaLabel = kpi.kind === 'alvo' ? 'Alvo' : 'Meta'
                          return (
                            <td key={kpi.id}>
                              <div className="matriz-bulk-cell">
                                {editor.mode === 'one' && needsMonthMeta(kpi.kind) && (
                                  <label className="matriz-bulk-field">
                                    <span>{metaLabel}</span>
                                    <input
                                      className="matriz-bulk-input"
                                      {...bindEditorField(`meta:${key}`)}
                                      value={metaDrafts[key] ?? ''}
                                      onChange={(e) =>
                                        setMetaDrafts((d) => ({ ...d, [key]: e.target.value }))
                                      }
                                      inputMode="decimal"
                                      placeholder="—"
                                      aria-label={`${store.code} · ${kpi.nome} ${metaLabel}`}
                                    />
                                  </label>
                                )}
                                <label className="matriz-bulk-field">
                                  {editor.mode === 'one' && <span>Real</span>}
                                  <input
                                    className="matriz-bulk-input"
                                    {...bindEditorField(`real:${key}`)}
                                    value={drafts[key] ?? ''}
                                    onChange={(e) =>
                                      setDrafts((d) => ({ ...d, [key]: e.target.value }))
                                    }
                                    inputMode="decimal"
                                    placeholder="—"
                                    aria-label={`${store.code} · ${kpi.nome} Real`}
                                  />
                                </label>
                              </div>
                              {open &&
                                (kpi.subs ?? [])
                                  .filter((s) => s.ativo !== false && s.kind !== 'conversao')
                                  .map((sub) => {
                                    const subKey = draftKey(store.code, `${kpi.id}::${sub.id}`)
                                    const subMetaLabel = sub.kind === 'alvo' ? 'Alvo' : 'Meta'
                                    return (
                                      <div key={sub.id} className="matriz-bulk-subcell">
                                        <span className="matriz-bulk-subhead">{sub.nome}</span>
                                        <div className="matriz-bulk-cell">
                                          {editor.mode === 'one' && needsMonthMeta(sub.kind) && (
                                            <label className="matriz-bulk-field">
                                              <span>{subMetaLabel}</span>
                                              <input
                                                className="matriz-bulk-input"
                                                {...bindEditorField(`meta:${subKey}`)}
                                                value={metaDrafts[subKey] ?? ''}
                                                onChange={(e) =>
                                                  setMetaDrafts((d) => ({
                                                    ...d,
                                                    [subKey]: e.target.value,
                                                  }))
                                                }
                                                inputMode="decimal"
                                                placeholder="—"
                                              />
                                            </label>
                                          )}
                                          <label className="matriz-bulk-field">
                                            {editor.mode === 'one' && <span>Real</span>}
                                            <input
                                              className="matriz-bulk-input"
                                              {...bindEditorField(`real:${subKey}`)}
                                              value={drafts[subKey] ?? ''}
                                              onChange={(e) =>
                                                setDrafts((d) => ({
                                                  ...d,
                                                  [subKey]: e.target.value,
                                                }))
                                              }
                                              inputMode="decimal"
                                              placeholder="—"
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    )
                                  })}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {message && <p className="painel-toast">{message}</p>}

            <div className="painel-store-actions">
              <button
                type="button"
                className="painel-btn painel-btn--primary"
                disabled={busy}
                onClick={() => void saveEditor()}
              >
                {busy
                  ? 'Salvando…'
                  : editor.mode === 'bulk'
                    ? `Salvar reais (${editorStores.length})`
                    : 'Salvar loja'}
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

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { subscribeStoreKpis } from '../../firebase/kpis'
import {
  asFiniteNumber,
  cellForKpi,
  cellForSub,
  dailyRitmoToHitMetaPct,
  describeDailyRitmoToHit,
  describeProjPct,
  formatMatrixNumber,
  formatMonthPaceLabel,
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
import { countBusinessDaysRemaining } from '../../lib/time'
import {
  INDICATOR_KIND_SHORT,
  alvoUnidadeShort,
  needsMonthMetaFor,
} from '../../firebase/types'
import { ThemeSelect } from '../../ui/ThemeSelect'

type Props = {
  stores: StoreMeta[]
}

type StoreMatrixData = {
  metas: MatrixMetaTree
  checks: MonthCheckTotals
  overrides: MonthResultOverride
}

/** União ao vivo dos KPIs das lojas — some da matriz só quando não existe mais em nenhuma. */
function mergeKpiCatalog(
  kpisByStore: Record<string, StoreKpi[]>,
  codes: string[],
): StoreKpi[] {
  const byId = new Map<string, StoreKpi>()
  for (const code of codes) {
    for (const kpi of kpisByStore[code] ?? []) {
      if (kpi.ativo === false) continue
      if (!byId.has(kpi.id)) byId.set(kpi.id, kpi)
    }
  }
  return [...byId.values()].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
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

function ritmoTone(gap: number | null): 'good' | 'warn' | 'bad' | 'empty' {
  if (gap == null || !Number.isFinite(gap)) return 'empty'
  if (gap <= 0) return 'good'
  return 'warn'
}

function formatRitmoDaily(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (Math.abs(value) < 1e-9) return '0'
  if (Math.abs(value) >= 10) return formatMatrixNumber(value, 1)
  return formatMatrixNumber(value, 2)
}

function CellStack({
  cell,
  alvoUnidade,
  monthKey,
  showRitmoTargets = false,
}: {
  cell: MatrixCellView
  alvoUnidade?: AlvoUnidade | null
  monthKey: string
  /** Só KPI-mãe Volume (Meta · Real · Proj%). */
  showRitmoTargets?: boolean
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
    if (alvoUnidade === 'evidencia') {
      return (
        <div className="matriz-cell matriz-cell--alvo matriz-cell--evidencia">
          <div className="matriz-metric">
            <span className="matriz-cell-label">Real</span>
            <strong className="matriz-real-value">{formatAlvoValue(cell.real, 'absolute')}</strong>
          </div>
        </div>
      )
    }
    return (
      <div className="matriz-cell matriz-cell--alvo">
        <div className="matriz-metric">
          <span className="matriz-cell-label">Alvo</span>
          <strong className="matriz-meta-value">{formatAlvoValue(cell.meta, alvoUnidade)}</strong>
        </div>
        <div className="matriz-metric">
          <span className="matriz-cell-label">Real</span>
          <strong className="matriz-real-value">{formatAlvoValue(cell.real, alvoUnidade)}</strong>
        </div>
      </div>
    )
  }
  const tone = projTone(cell.projPct)
  const projTitle = describeProjPct(cell.meta, cell.real, monthKey) ?? undefined
  const withRitmo = showRitmoTargets && cell.kind === 'volume'
  const ritmo100 = withRitmo
    ? dailyRitmoToHitMetaPct(cell.meta, cell.real, 100, monthKey)
    : null
  const ritmo85 = withRitmo
    ? dailyRitmoToHitMetaPct(cell.meta, cell.real, 85, monthKey)
    : null
  return (
    <div className={`matriz-cell matriz-cell--volume ${withRitmo ? 'matriz-cell--ritmo' : ''}`}>
      <div className="matriz-metric">
        <span className="matriz-cell-label">Meta</span>
        <strong className="matriz-meta-value">{formatMatrixNumber(cell.meta)}</strong>
      </div>
      <div className="matriz-metric">
        <span className="matriz-cell-label">Real</span>
        <strong
          className={`matriz-real-value ${cell.source === 'override' ? 'is-override' : ''}`}
          title={cell.source === 'override' ? 'Real lançado no painel' : 'Real do checkout'}
        >
          {formatMatrixNumber(cell.real)}
        </strong>
      </div>
      <div className="matriz-metric" title={projTitle}>
        <span className="matriz-cell-label">Proj%</span>
        <strong className={`matriz-proj is-${tone}`}>{formatPct(cell.projPct)}</strong>
      </div>
      {withRitmo && (
        <>
          <div
            className="matriz-metric"
            title={describeDailyRitmoToHit(cell.meta, cell.real, 100, monthKey) ?? undefined}
          >
            <span className="matriz-cell-label">p/100%</span>
            <strong className={`matriz-ritmo is-${ritmoTone(ritmo100)}`}>
              {formatRitmoDaily(ritmo100)}
            </strong>
          </div>
          <div
            className="matriz-metric"
            title={describeDailyRitmoToHit(cell.meta, cell.real, 85, monthKey) ?? undefined}
          >
            <span className="matriz-cell-label">p/85%</span>
            <strong className={`matriz-ritmo is-${ritmoTone(ritmo85)}`}>
              {formatRitmoDaily(ritmo85)}
            </strong>
          </div>
        </>
      )}
    </div>
  )
}

function defaultMetricForKind(
  kind: StoreKpi['kind'],
  alvoUnidade?: AlvoUnidade | null,
): Exclude<SortMetric, 'az'> {
  if (kind === 'conversao') return 'proj'
  if (kind === 'alvo') return alvoUnidade === 'evidencia' ? 'real' : 'meta'
  return 'real'
}

function sortMetricLabel(
  metric: SortMetric,
  kind: StoreKpi['kind'],
  alvoUnidade?: AlvoUnidade | null,
): string {
  if (metric === 'az') return 'A–Z'
  if (metric === 'meta') return kind === 'alvo' ? 'Alvo' : 'Meta'
  if (metric === 'real') return alvoUnidade === 'evidencia' ? 'Evid.' : 'Real'
  return kind === 'conversao' ? 'Conv%' : 'Proj%'
}

function metricsForKind(
  kind: StoreKpi['kind'],
  alvoUnidade?: AlvoUnidade | null,
): Array<Exclude<SortMetric, 'az'>> {
  if (kind === 'conversao') return ['proj']
  if (kind === 'alvo') return alvoUnidade === 'evidencia' ? ['real'] : ['meta', 'real']
  return ['meta', 'real', 'proj']
}

export function MatrizTab({ stores }: Props) {
  const monthOptions = useMemo(() => recentMonthKeys(8), [])
  const [monthKey, setMonthKey] = useState(() => currentMonthKey())
  const [kpisByStore, setKpisByStore] = useState<Record<string, StoreKpi[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  /** Visões isoladas: um listener/escrita nunca apaga a outra. */
  const [metasByStore, setMetasByStore] = useState<Record<string, MatrixMetaTree>>({})
  const [checksByStore, setChecksByStore] = useState<Record<string, MonthCheckTotals>>({})
  const [resultsByStore, setResultsByStore] = useState<Record<string, MonthResultOverride>>({})
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
  /** Chave estável — evita remount quando a lista de lojas só muda de referência. */
  const storeCodesKey = useMemo(
    () => activeStores.map((store) => store.code).join('|'),
    [activeStores],
  )
  const storeCodes = useMemo(
    () => (storeCodesKey ? storeCodesKey.split('|').filter(Boolean) : []),
    [storeCodesKey],
  )
  const storeData = (sigla: string): StoreMatrixData => ({
    metas: metasByStore[sigla] ?? {},
    checks: checksByStore[sigla] ?? {},
    overrides: resultsByStore[sigla] ?? {},
  })

  const columns = useMemo(
    () => mergeKpiCatalog(kpisByStore, storeCodes),
    [kpisByStore, storeCodes],
  )

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
      const cell = cellForKpi({
        kpi: sortKpi,
        monthKey,
        metas: metasByStore[sigla] ?? {},
        checks: checksByStore[sigla] ?? {},
        overrides: resultsByStore[sigla] ?? {},
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
  }, [
    activeStores,
    storeFilter,
    sortMetric,
    sortKpiId,
    columns,
    metasByStore,
    checksByStore,
    resultsByStore,
    monthKey,
  ])

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
        if (editor.mode === 'one' && needsMonthMetaFor(kpi)) {
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
            if (editor.mode === 'one' && needsMonthMetaFor(sub)) {
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
    /**
     * Grade visual no editor da sigla (Meta acima de Real):
     *   Lado  = percorre a linha (Meta1→Meta2→… → Real1→Real2→…)
     *   Baixo = desce a coluna (Meta1→Real1→Meta2→Real2→…)
     * No bulk (só Real, várias lojas):
     *   Lado  = ao longo da linha da loja
     *   Baixo = descendo a coluna do KPI
     */
    if (editor?.mode === 'one') {
      const metas: string[] = []
      const reals: string[] = []
      const vertical: string[] = []
      for (const field of editorFields) {
        if (field.kind === 'meta') metas.push(field.fieldId)
        else reals.push(field.fieldId)
      }
      if (tabNav === 'lado') return [...metas, ...reals]
      for (const kpi of editableColumns) {
        const meta = editorFields.find((f) => f.kind === 'meta' && f.col === kpi.id)
        const real = editorFields.find((f) => f.kind === 'real' && f.col === kpi.id)
        if (meta) vertical.push(meta.fieldId)
        if (real) vertical.push(real.fieldId)
        if (bulkExpanded[kpi.id]) {
          for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false && s.kind !== 'conversao')) {
            const key = `${kpi.id}::${sub.id}`
            const subMeta = editorFields.find((f) => f.kind === 'meta' && f.col === key)
            const subReal = editorFields.find((f) => f.kind === 'real' && f.col === key)
            if (subMeta) vertical.push(subMeta.fieldId)
            if (subReal) vertical.push(subReal.fieldId)
          }
        }
      }
      return vertical
    }

    if (tabNav === 'lado') return editorFields.map((f) => f.fieldId)

    const byCol = new Map<string, string[]>()
    for (const field of editorFields) {
      const col = field.col ?? field.group
      const list = byCol.get(col) ?? []
      list.push(field.fieldId)
      byCol.set(col, list)
    }
    const ordered: string[] = []
    for (const kpi of editableColumns) {
      ordered.push(...(byCol.get(kpi.id) ?? []))
      if (bulkExpanded[kpi.id]) {
        for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false && s.kind !== 'conversao')) {
          ordered.push(...(byCol.get(`${kpi.id}::${sub.id}`) ?? []))
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
    const preferred = defaultMetricForKind(kpi.kind, kpi.alvoUnidade)
    if (sortKpiId === kpi.id && sortMetric === preferred) {
      const cycle = metricsForKind(kpi.kind, kpi.alvoUnidade)
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
    setKpisByStore({})
    if (storeCodes.length === 0) return

    const unsubs: Array<() => void> = []
    for (const code of storeCodes) {
      unsubs.push(
        subscribeStoreKpis(code, (kpis) => {
          setKpisByStore((prev) => ({
            ...prev,
            [code]: kpis.filter((kpi) => kpi.ativo !== false),
          }))
        }),
      )
    }
    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [storeCodesKey]) // storeCodes derivado de storeCodesKey

  useEffect(() => {
    const ids = new Set(columns.map((kpi) => kpi.id))
    if (sortKpiId && !ids.has(sortKpiId)) {
      setSortKpiId('')
      setSortMetric('az')
    }
    setExpanded((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setBulkExpanded((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [columns, sortKpiId])

  useEffect(() => {
    setMetasByStore({})
    setChecksByStore({})
    setResultsByStore({})
    if (storeCodes.length === 0) return

    const unsubs: Array<() => void> = []
    for (const code of storeCodes) {
      unsubs.push(
        subscribeMonthMetasTree(code, monthKey, (metas) => {
          setMetasByStore((prev) => ({ ...prev, [code]: metas }))
        }),
      )
      unsubs.push(
        subscribeMonthCheckTotals(code, monthKey, (checks) => {
          setChecksByStore((prev) => ({ ...prev, [code]: checks }))
        }),
      )
      unsubs.push(
        subscribeMonthResults(code, monthKey, (overrides) => {
          setResultsByStore((prev) => ({ ...prev, [code]: overrides }))
        }),
      )
    }

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [storeCodesKey, monthKey])

  const parseDraftNumber = (raw: string | undefined, label: string): number | null => {
    if (raw == null) return null
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const value = asFiniteNumber(trimmed)
    if (value == null) throw new Error(`${label} inválido.`)
    return value
  }

  const openOneEditor = (sigla: string) => {
    const data = storeData(sigla)
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
      const data = storeData(store.code)
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

  const patchLocalMeta = (
    sigla: string,
    kpiId: string,
    valor: number,
    subId?: string,
  ) => {
    setMetasByStore((prev) => {
      const tree = { ...(prev[sigla] ?? {}) }
      if (subId) {
        const parent = { ...(tree[kpiId] ?? {}) }
        const subs = { ...(parent.subs ?? {}) }
        subs[subId] = {
          ...(subs[subId] ?? {}),
          valor,
          updatedAt: new Date().toISOString(),
          updatedBy: 'painel',
        }
        tree[kpiId] = { ...parent, subs }
      } else {
        tree[kpiId] = {
          ...(tree[kpiId] ?? {}),
          valor,
          updatedAt: new Date().toISOString(),
          updatedBy: 'painel',
        }
      }
      return { ...prev, [sigla]: tree }
    })
  }

  const patchLocalReal = (
    sigla: string,
    kpiId: string,
    valor: number,
    subId?: string,
  ) => {
    setResultsByStore((prev) => {
      const tree = { ...(prev[sigla] ?? {}) }
      if (subId) {
        const parent = { ...(tree[kpiId] ?? {}) }
        const subs = { ...(parent.subs ?? {}) }
        subs[subId] = { ...(subs[subId] ?? {}), valor }
        tree[kpiId] = { ...parent, subs }
      } else {
        tree[kpiId] = {
          ...(tree[kpiId] ?? {}),
          valor,
          updatedAt: new Date().toISOString(),
          updatedBy: 'painel',
        }
      }
      return { ...prev, [sigla]: tree }
    })
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
          if (editor.mode === 'one' && needsMonthMetaFor(kpi)) {
            const meta = parseDraftNumber(
              metaDrafts[draftKey(sigla, kpi.id)],
              `${sigla} · ${kpi.nome} (${kpi.kind === 'alvo' ? 'Alvo' : 'Meta'})`,
            )
            if (meta != null) {
              await saveKpiMonthMeta({ sigla, monthKey, kpiId: kpi.id, valor: meta })
              patchLocalMeta(sigla, kpi.id, meta)
              wrote += 1
            }
          }
          const real = parseDraftNumber(
            drafts[draftKey(sigla, kpi.id)],
            `${sigla} · ${kpi.nome} (Real)`,
          )
          if (real != null) {
            await saveKpiMonthResult({ sigla, monthKey, kpiId: kpi.id, valor: real })
            patchLocalReal(sigla, kpi.id, real)
            wrote += 1
          }
          for (const sub of (kpi.subs ?? []).filter((s) => s.ativo !== false)) {
            if (sub.kind === 'conversao') continue
            const key = `${kpi.id}::${sub.id}`
            if (editor.mode === 'one' && needsMonthMetaFor(sub)) {
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
                patchLocalMeta(sigla, kpi.id, meta, sub.id)
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
              patchLocalReal(sigla, kpi.id, subReal, sub.id)
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
    const el =
      editorFieldRefs.current[fieldId] ??
      (typeof document !== 'undefined'
        ? (document.querySelector(`[data-editor-field="${fieldId}"]`) as HTMLInputElement | null)
        : null)
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
    event.stopPropagation()
    const delta = event.shiftKey ? -1 : 1
    const nextIndex = (index + delta + order.length) % order.length
    const nextId = order[nextIndex]!
    // rAF: garante que o foco rode depois do ciclo atual do input
    window.requestAnimationFrame(() => focusEditorField(nextId))
  }

  const bindEditorField = (fieldId: string) => ({
    ref: (el: HTMLInputElement | null) => {
      editorFieldRefs.current[fieldId] = el
    },
    'data-editor-field': fieldId,
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

  const paceLabel = formatMonthPaceLabel(monthKey)
  const businessDaysLeft = countBusinessDaysRemaining(monthKey)

  return (
    <div className="painel-tab">
      <section className="painel-panel matriz-toolbar matriz-toolbar--slim">
        <div className="matriz-toolbar-line">
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

          <ThemeSelect
            className="matriz-month-select"
            label="Mês"
            value={monthKey}
            onChange={setMonthKey}
            options={monthOptions.map((key) => ({ value: key, label: key }))}
          />

          <span
            className="matriz-pace-chip"
            title="Proj% usa dias corridos. Ritmo p/100% e p/85% = (alvo − Real) ÷ dias úteis restantes (Seg–Sáb)."
          >
            {paceLabel}
            {businessDaysLeft > 0 ? ` · ${businessDaysLeft} úteis` : ''}
          </span>

          <button
            type="button"
            className="painel-btn painel-btn--primary matriz-toolbar-action"
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
        {message && <p className="painel-toast matriz-toolbar-toast">{message}</p>}
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
                                  ? ` · ↓ ${sortMetricLabel(sortMetric, kpi.kind, kpi.alvoUnidade)}`
                                  : ''}
                              </small>
                            </span>
                          </button>
                          <div className="matriz-sort-chips" role="group" aria-label={`Ordenar ${kpi.nome}`}>
                            {metricsForKind(kpi.kind, kpi.alvoUnidade).map((metric) => (
                              <button
                                key={metric}
                                type="button"
                                className={`matriz-sort-chip ${
                                  active && sortMetric === metric ? 'is-on' : ''
                                }`}
                                onClick={() => sortByKpiMetric(kpi, metric)}
                              >
                                {sortMetricLabel(metric, kpi.kind, kpi.alvoUnidade)}
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
                  const data = storeData(store.code)
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
                            <CellStack
                              cell={cell}
                              alvoUnidade={kpi.alvoUnidade}
                              monthKey={monthKey}
                              showRitmoTargets={kpi.kind === 'volume'}
                            />
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
                                      monthKey={monthKey}
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
                        const unit = alvoUnidadeShort(kpi.alvoUnidade)
                        const headFields =
                          editor.mode === 'one'
                            ? needsMonthMetaFor(kpi)
                              ? `${kpi.kind === 'alvo' ? 'Alvo' : 'Meta'} · Real`
                              : kpi.alvoUnidade === 'evidencia'
                                ? 'Evid. · Real'
                                : 'Real'
                            : 'Real'
                        return (
                          <th key={kpi.id} style={{ ['--kpi' as string]: kpi.cor }}>
                            <div className="matriz-bulk-colhead">
                              <span className="matriz-kpi-dot" aria-hidden />
                              <div>
                                <strong>{kpi.nome}</strong>
                                <small>
                                  {headFields}
                                  {unit ? ` · ${unit}` : ''}
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
                                {editor.mode === 'one' && needsMonthMetaFor(kpi) && (
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
                                  {editor.mode === 'one' && (
                                    <span>
                                      {kpi.alvoUnidade === 'evidencia' ? 'Evidência' : 'Real'}
                                    </span>
                                  )}
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
                                    const subUnit = alvoUnidadeShort(sub.alvoUnidade)
                                    return (
                                      <div key={sub.id} className="matriz-bulk-subcell">
                                        <span className="matriz-bulk-subhead">
                                          {sub.nome}
                                          {subUnit ? ` · ${subUnit}` : ''}
                                        </span>
                                        <div className="matriz-bulk-cell">
                                          {editor.mode === 'one' && needsMonthMetaFor(sub) && (
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
                                            {editor.mode === 'one' && (
                                              <span>
                                                {sub.alvoUnidade === 'evidencia'
                                                  ? 'Evidência'
                                                  : 'Real'}
                                              </span>
                                            )}
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

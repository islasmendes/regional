import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  allocateEntityId,
  createStoreKpi,
  createStoreKpiSub,
  defaultKpiColor,
  deleteStoreKpi,
  deleteStoreKpiSub,
  forEachStoreSigla,
  formulaLabel,
  formulaOptionsFromKpis,
  moveStoreKpi,
  operandToSelectValue,
  selectValueToOperand,
  subscribeStoreKpis,
  upsertStoreKpi,
  upsertStoreKpiSub,
} from '../../firebase/kpis'
import type {
  AlvoUnidade,
  ConversionFormula,
  IndicatorKind,
  StoreKpi,
  StoreKpiSub,
  StoreMeta,
} from '../../firebase/types'
import {
  ALVO_UNIDADE_LABELS,
  INDICATOR_KIND_LABELS,
  INDICATOR_KIND_SHORT,
  defaultChecksForKind,
} from '../../firebase/types'
import {
  STORE_SCOPE_ALL,
  canonicalSigla,
  isStoreScopeAll,
  resolveTargetSiglas,
  storeScopeLabel,
  type StoreScope,
} from '../../lib/storeScope'
import { ThemeFlags } from '../../ui/ThemeFlags'
import { ThemeSelect } from '../../ui/ThemeSelect'
import { StoreScopeSelect } from '../StoreScopeSelect'

type Props = {
  stores: StoreMeta[]
}

type KpiDraft = {
  nome: string
  cor: string
  kind: IndicatorKind
  alvoUnidade: AlvoUnidade
  checkIn: boolean
  checkOut: boolean
  numRef: string
  denRef: string
}

type SubDraft = {
  nome: string
  kind: IndicatorKind
  alvoUnidade: AlvoUnidade
  checkIn: boolean
  checkOut: boolean
  numRef: string
  denRef: string
}

const emptyKpiDraft = (): KpiDraft => ({
  nome: '',
  cor: defaultKpiColor(0),
  kind: 'volume',
  alvoUnidade: 'percent',
  checkIn: true,
  checkOut: true,
  numRef: '',
  denRef: '',
})

const emptySubDraft = (): SubDraft => ({
  nome: '',
  kind: 'conversao',
  alvoUnidade: 'percent',
  checkIn: false,
  checkOut: false,
  numRef: '',
  denRef: '',
})

function formulaFromDraft(kind: IndicatorKind, numRef: string, denRef: string): ConversionFormula | null {
  if (kind !== 'conversao') return null
  const numerator = selectValueToOperand(numRef)
  const denominator = selectValueToOperand(denRef)
  if (!numerator || !denominator) return null
  return { op: 'div', numerator, denominator }
}

function kindSummary(kind: IndicatorKind, alvoUnidade: AlvoUnidade | null | undefined): string {
  if (kind === 'conversao') return 'Conversão A ÷ B'
  if (kind === 'alvo') {
    return alvoUnidade === 'absolute' ? 'Alvo · número absoluto' : 'Alvo · percentual (%)'
  }
  return 'Volume · Meta/Real na Matriz'
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  hint?: string
}) {
  return (
    <button
      type="button"
      className={`painel-toggle ${checked ? 'is-on' : 'is-off'}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="painel-toggle-track" aria-hidden>
        <span className="painel-toggle-thumb" />
      </span>
      <span className="painel-toggle-copy">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  )
}

function KindBadge({ kind }: { kind: IndicatorKind }) {
  return <span className={`painel-kind-badge painel-kind-badge--${kind}`}>{INDICATOR_KIND_SHORT[kind]}</span>
}

function AlvoUnidadeField({
  value,
  onChange,
}: {
  value: AlvoUnidade
  onChange: (next: AlvoUnidade) => void
}) {
  return (
    <ThemeSelect
      label="Unidade do Alvo"
      value={value}
      onChange={(raw) => onChange(raw as AlvoUnidade)}
      options={(Object.keys(ALVO_UNIDADE_LABELS) as AlvoUnidade[]).map((unit) => ({
        value: unit,
        label: ALVO_UNIDADE_LABELS[unit],
      }))}
    />
  )
}

export function KpisTab({ stores }: Props) {
  const [scope, setScope] = useState<StoreScope>(STORE_SCOPE_ALL)
  const [kpis, setKpis] = useState<StoreKpi[]>([])
  const [draft, setDraft] = useState<KpiDraft>(emptyKpiDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subDraft, setSubDraft] = useState<SubDraft>(emptySubDraft)
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const targets = useMemo(() => resolveTargetSiglas(scope, stores), [scope, stores])
  const readSigla = useMemo(() => canonicalSigla(scope, stores), [scope, stores])
  const scopeText = storeScopeLabel(scope, targets.length)

  useEffect(() => {
    if (!readSigla) {
      setKpis([])
      return
    }
    return subscribeStoreKpis(readSigla, setKpis)
  }, [readSigla])

  const formulaOptions = useMemo(() => formulaOptionsFromKpis(kpis), [kpis])

  const onChangeScope = (next: StoreScope) => {
    setScope(next)
    setEditingId(null)
    setDraft(emptyKpiDraft())
    setExpandedId(null)
    setEditingSubId(null)
    setSubDraft(emptySubDraft())
    setMessage(null)
  }

  const onSubmitKpi = async (event: FormEvent) => {
    event.preventDefault()
    if (targets.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const formula = formulaFromDraft(draft.kind, draft.numRef, draft.denRef)
      const payload = {
        nome: draft.nome,
        cor: draft.cor,
        kind: draft.kind,
        alvoUnidade: draft.kind === 'alvo' ? draft.alvoUnidade : null,
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        formula,
      }
      const kpiId = editingId ?? allocateEntityId('k')
      if (editingId) {
        await forEachStoreSigla(targets, (sigla) => upsertStoreKpi(sigla, editingId, payload))
      } else {
        await forEachStoreSigla(targets, (sigla) => createStoreKpi(sigla, { ...payload, id: kpiId }))
      }

      setMessage(editingId ? `KPI atualizado em ${scopeText}.` : `KPI criado em ${scopeText}.`)
      setDraft(emptyKpiDraft())
      setEditingId(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar KPI.')
    } finally {
      setBusy(false)
    }
  }

  const onEditKpi = (kpi: StoreKpi) => {
    setEditingId(kpi.id)
    setExpandedId(kpi.id)
    setDraft({
      nome: kpi.nome,
      cor: kpi.cor,
      kind: kpi.kind,
      alvoUnidade: kpi.alvoUnidade ?? 'percent',
      checkIn: kpi.checkIn,
      checkOut: kpi.checkOut,
      numRef: operandToSelectValue(kpi.formula?.numerator),
      denRef: operandToSelectValue(kpi.formula?.denominator),
    })
    setMessage(null)
  }

  const onCancelKpi = () => {
    setEditingId(null)
    setDraft(emptyKpiDraft())
  }

  const onDeleteKpi = async (kpi: StoreKpi) => {
    if (targets.length === 0) return
    const where = isStoreScopeAll(scope) ? 'em TODAS as lojas' : `em ${scope}`
    if (!window.confirm(`Excluir o KPI "${kpi.nome}" ${where}?`)) return
    setBusy(true)
    setMessage(null)
    try {
      await forEachStoreSigla(targets, (sigla) => deleteStoreKpi(sigla, kpi.id))
      if (editingId === kpi.id) onCancelKpi()
      if (expandedId === kpi.id) setExpandedId(null)
      setMessage(`KPI ${kpi.nome} removido de ${scopeText}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao excluir KPI.')
    } finally {
      setBusy(false)
    }
  }

  const onMoveKpi = async (kpiId: string, direction: 'up' | 'down') => {
    if (targets.length === 0) return
    setBusy(true)
    try {
      await forEachStoreSigla(targets, (sigla) => moveStoreKpi(sigla, kpiId, direction))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao reordenar.')
    } finally {
      setBusy(false)
    }
  }

  const onSubmitSub = async (event: FormEvent, parent: StoreKpi) => {
    event.preventDefault()
    if (targets.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const formula = formulaFromDraft(subDraft.kind, subDraft.numRef, subDraft.denRef)
      const payload = {
        nome: subDraft.nome,
        kind: subDraft.kind,
        alvoUnidade: subDraft.kind === 'alvo' ? subDraft.alvoUnidade : null,
        checkIn: subDraft.checkIn,
        checkOut: subDraft.checkOut,
        formula,
      }
      const subId = editingSubId ?? allocateEntityId('s')
      if (editingSubId) {
        await forEachStoreSigla(targets, (sigla) =>
          upsertStoreKpiSub(sigla, parent.id, editingSubId, payload),
        )
      } else {
        await forEachStoreSigla(targets, (sigla) =>
          createStoreKpiSub(sigla, parent.id, { ...payload, id: subId }),
        )
      }

      setMessage(`Subindicador salvo em ${scopeText} (dentro de ${parent.nome}).`)
      setSubDraft(emptySubDraft())
      setEditingSubId(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar sub.')
    } finally {
      setBusy(false)
    }
  }

  const onEditSub = (parent: StoreKpi, sub: StoreKpiSub) => {
    setExpandedId(parent.id)
    setEditingSubId(sub.id)
    setSubDraft({
      nome: sub.nome,
      kind: sub.kind,
      alvoUnidade: sub.alvoUnidade ?? 'percent',
      checkIn: sub.checkIn,
      checkOut: sub.checkOut,
      numRef: operandToSelectValue(sub.formula?.numerator),
      denRef: operandToSelectValue(sub.formula?.denominator),
    })
  }

  const renderFormulaFields = (
    kind: IndicatorKind,
    numRef: string,
    denRef: string,
    onNum: (v: string) => void,
    onDen: (v: string) => void,
  ) => {
    if (kind !== 'conversao') return null
    return (
      <div className="painel-formula-box">
        <div className="painel-form--row">
          <ThemeSelect
            label="Numerador"
            value={numRef}
            onChange={onNum}
            placeholder="Selecione…"
            options={formulaOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
          <ThemeSelect
            label="Denominador"
            value={denRef}
            onChange={onDen}
            placeholder="Selecione…"
            options={formulaOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </div>
        {numRef && denRef && (
          <p className="painel-formula-preview">
            Conversão ={' '}
            <strong>
              {formulaOptions.find((o) => o.value === numRef)?.label ?? '?'} ÷{' '}
              {formulaOptions.find((o) => o.value === denRef)?.label ?? '?'}
            </strong>
          </p>
        )}
      </div>
    )
  }

  if (stores.length === 0) {
    return (
      <div className="painel-tab">
        <section className="painel-panel">
          <p className="painel-muted">Cadastre uma loja antes de criar indicadores.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="painel-tab">
      <section className="painel-panel">
        <StoreScopeSelect stores={stores} value={scope} onChange={onChangeScope} />
      </section>

      <section className="painel-panel">
        <h3>{editingId ? 'Editar KPI-mãe' : 'Novo KPI-mãe'}</h3>
        <form className="painel-form" onSubmit={(e) => void onSubmitKpi(e)}>
          <div className="painel-form--row">
            <label>
              Nome
              <input
                value={draft.nome}
                onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                placeholder="Ex.: Agendamentos"
                required
                minLength={2}
              />
            </label>
            <label>
              Cor
              <input
                type="color"
                value={draft.cor}
                onChange={(e) => setDraft((d) => ({ ...d, cor: e.target.value }))}
              />
            </label>
          </div>

          <ThemeSelect
            label="Tipo na matriz"
            value={draft.kind}
            onChange={(raw) => {
              const kind = raw as IndicatorKind
              const checks = defaultChecksForKind(kind)
              setDraft((d) => ({
                ...d,
                kind,
                checkIn: checks.checkIn,
                checkOut: checks.checkOut,
                numRef: kind === 'conversao' ? d.numRef : '',
                denRef: kind === 'conversao' ? d.denRef : '',
              }))
            }}
            options={(Object.keys(INDICATOR_KIND_LABELS) as IndicatorKind[]).map((kind) => ({
              value: kind,
              label: INDICATOR_KIND_LABELS[kind],
            }))}
          />

          {draft.kind === 'alvo' && (
            <AlvoUnidadeField
              value={draft.alvoUnidade}
              onChange={(alvoUnidade) => setDraft((d) => ({ ...d, alvoUnidade }))}
            />
          )}

          <div className="painel-kpi-flags">
            <Toggle
              label="Check-in"
              checked={draft.checkIn}
              onChange={(checkIn) => setDraft((d) => ({ ...d, checkIn }))}
            />
            <Toggle
              label="Check-out"
              checked={draft.checkOut}
              onChange={(checkOut) => setDraft((d) => ({ ...d, checkOut }))}
            />
          </div>

          {renderFormulaFields(
            draft.kind,
            draft.numRef,
            draft.denRef,
            (numRef) => setDraft((d) => ({ ...d, numRef })),
            (denRef) => setDraft((d) => ({ ...d, denRef })),
          )}

          <p className="painel-muted">
            Meta/Alvo mensal é lançado na Matriz, clicando na sigla da loja.
          </p>

          <div className="painel-store-actions">
            <button
              type="submit"
              className="painel-btn painel-btn--primary"
              disabled={busy || targets.length === 0}
            >
              {busy
                ? 'Salvando…'
                : editingId
                  ? `Salvar KPI (${scopeText})`
                  : `Criar KPI (${scopeText})`}
            </button>
            {editingId && (
              <button type="button" className="painel-btn painel-btn--ghost" onClick={onCancelKpi}>
                Cancelar
              </button>
            )}
          </div>
        </form>
        {message && <p className="painel-toast">{message}</p>}
      </section>

      <section className="painel-panel">
        <div className="painel-panel-head">
          <h3>
            Indicadores —{' '}
            {isStoreScopeAll(scope)
              ? `TODOS (preview ${readSigla ?? '—'})`
              : scope}
          </h3>
          <span className="painel-count">{kpis.length}</span>
        </div>
        {kpis.length === 0 ? (
          <p className="painel-muted">Nenhum KPI nesta loja ainda.</p>
        ) : (
          <ul className="painel-store-list">
            {kpis.map((kpi, index) => {
              const open = expandedId === kpi.id
              const subCount = kpi.subs?.length ?? 0
              return (
                <li key={kpi.id} className="painel-store-item painel-kpi-block">
                  <div className="painel-kpi-item-main">
                    <span className="painel-kpi-swatch" style={{ background: kpi.cor }} aria-hidden />
                    <div>
                      <div className="painel-kpi-title-row">
                        <strong>{kpi.nome}</strong>
                        <KindBadge kind={kpi.kind} />
                        <ThemeFlags checkIn={kpi.checkIn} checkOut={kpi.checkOut} />
                      </div>
                      <span className="painel-muted">
                        {kpi.kind === 'conversao'
                          ? `Fórmula: ${formulaLabel(kpi.formula, kpis)}`
                          : kindSummary(kpi.kind, kpi.alvoUnidade)}
                        {subCount > 0 ? ` · ${subCount} sub(s)` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="painel-store-actions">
                    <button
                      type="button"
                      className="painel-btn painel-btn--ghost"
                      onClick={() => setExpandedId(open ? null : kpi.id)}
                    >
                      {open ? 'Recolher' : 'Subs'}
                    </button>
                    <button
                      type="button"
                      className="painel-btn painel-btn--ghost"
                      disabled={busy || index === 0}
                      onClick={() => void onMoveKpi(kpi.id, 'up')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="painel-btn painel-btn--ghost"
                      disabled={busy || index === kpis.length - 1}
                      onClick={() => void onMoveKpi(kpi.id, 'down')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="painel-btn painel-btn--ghost"
                      disabled={busy}
                      onClick={() => onEditKpi(kpi)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="painel-btn painel-btn--danger"
                      disabled={busy}
                      onClick={() => void onDeleteKpi(kpi)}
                    >
                      Excluir
                    </button>
                  </div>

                  {open && (
                    <div className="painel-kpi-subs">
                      <h4>Subindicadores de {kpi.nome}</h4>

                      {(kpi.subs ?? []).length === 0 ? (
                        <p className="painel-muted">Nenhum sub ainda.</p>
                      ) : (
                        <ul className="painel-store-list">
                          {(kpi.subs ?? []).map((sub) => (
                            <li key={sub.id} className="painel-store-item">
                              <div>
                                <div className="painel-kpi-title-row">
                                  <strong>{sub.nome}</strong>
                                  <KindBadge kind={sub.kind} />
                                  <ThemeFlags checkIn={sub.checkIn} checkOut={sub.checkOut} />
                                </div>
                                <span className="painel-muted">
                                  {sub.kind === 'conversao'
                                    ? `Fórmula: ${formulaLabel(sub.formula, kpis)}`
                                    : kindSummary(sub.kind, sub.alvoUnidade)}
                                </span>
                              </div>
                              <div className="painel-store-actions">
                                <button
                                  type="button"
                                  className="painel-btn painel-btn--ghost"
                                  onClick={() => onEditSub(kpi, sub)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="painel-btn painel-btn--danger"
                                  disabled={busy}
                                  onClick={() => {
                                    void (async () => {
                                      if (
                                        !window.confirm(
                                          `Excluir sub "${sub.nome}" ${
                                            isStoreScopeAll(scope) ? 'em TODAS as lojas' : `em ${scope}`
                                          }?`,
                                        )
                                      ) {
                                        return
                                      }
                                      setBusy(true)
                                      try {
                                        await forEachStoreSigla(targets, (s) =>
                                          deleteStoreKpiSub(s, kpi.id, sub.id),
                                        )
                                        setMessage(`Sub removido de ${scopeText}.`)
                                      } catch (error) {
                                        setMessage(
                                          error instanceof Error
                                            ? error.message
                                            : 'Falha ao excluir sub.',
                                        )
                                      } finally {
                                        setBusy(false)
                                      }
                                    })()
                                  }}
                                >
                                  Excluir
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form className="painel-form" onSubmit={(e) => void onSubmitSub(e, kpi)}>
                        <h4>{editingSubId ? 'Editar sub' : 'Novo sub dentro deste KPI'}</h4>
                        <label>
                          Nome
                          <input
                            value={subDraft.nome}
                            onChange={(e) => setSubDraft((d) => ({ ...d, nome: e.target.value }))}
                            placeholder="Ex.: Conversão"
                            required
                            minLength={2}
                          />
                        </label>
                        <ThemeSelect
                          label="Tipo"
                          value={subDraft.kind}
                          onChange={(raw) => {
                            const kind = raw as IndicatorKind
                            const checks = defaultChecksForKind(kind)
                            setSubDraft((d) => ({
                              ...d,
                              kind,
                              checkIn: checks.checkIn,
                              checkOut: checks.checkOut,
                              numRef: kind === 'conversao' ? d.numRef : '',
                              denRef: kind === 'conversao' ? d.denRef : '',
                            }))
                          }}
                          options={(Object.keys(INDICATOR_KIND_LABELS) as IndicatorKind[]).map(
                            (kind) => ({
                              value: kind,
                              label: INDICATOR_KIND_LABELS[kind],
                            }),
                          )}
                        />
                        {subDraft.kind === 'alvo' && (
                          <AlvoUnidadeField
                            value={subDraft.alvoUnidade}
                            onChange={(alvoUnidade) => setSubDraft((d) => ({ ...d, alvoUnidade }))}
                          />
                        )}
                        <div className="painel-kpi-flags">
                          <Toggle
                            label="Check-in"
                            checked={subDraft.checkIn}
                            onChange={(checkIn) => setSubDraft((d) => ({ ...d, checkIn }))}
                          />
                          <Toggle
                            label="Check-out"
                            checked={subDraft.checkOut}
                            onChange={(checkOut) => setSubDraft((d) => ({ ...d, checkOut }))}
                          />
                        </div>
                        {renderFormulaFields(
                          subDraft.kind,
                          subDraft.numRef,
                          subDraft.denRef,
                          (numRef) => setSubDraft((d) => ({ ...d, numRef })),
                          (denRef) => setSubDraft((d) => ({ ...d, denRef })),
                        )}
                        <div className="painel-store-actions">
                          <button
                            type="submit"
                            className="painel-btn painel-btn--primary"
                            disabled={busy}
                          >
                            {editingSubId ? 'Salvar sub' : 'Adicionar sub'}
                          </button>
                          {editingSubId && (
                            <button
                              type="button"
                              className="painel-btn painel-btn--ghost"
                              onClick={() => {
                                setEditingSubId(null)
                                setSubDraft(emptySubDraft())
                              }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

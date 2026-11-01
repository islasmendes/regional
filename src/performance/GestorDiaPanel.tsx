import { useEffect, useMemo, useState } from 'react'
import { evaluateWindow, subscribeCheckSchedule } from '../firebase/checkSchedule'
import { formulaLabel, subscribeStoreKpis } from '../firebase/kpis'
import {
  saveManagerCheckEntry,
  subscribeDayChecks,
  type DayCheckMap,
} from '../firebase/managerChecks'
import type { CheckEntryTipo, CheckScheduleConfig, StoreKpi, StoreKpiSub } from '../firebase/types'
import { INDICATOR_KIND_SHORT } from '../firebase/types'
import { APP_TIMEZONE, getZonedNow } from '../lib/time'

type Props = {
  sigla: string
}

type LaunchTarget = {
  key: string
  label: string
  kpiId: string
  subId?: string
  tipo: CheckEntryTipo
  cor: string
}

export function GestorDiaPanel({ sigla }: Props) {
  const [nowTick, setNowTick] = useState(() => new Date())
  const [kpis, setKpis] = useState<StoreKpi[]>([])
  const [schedule, setSchedule] = useState<CheckScheduleConfig | null>(null)
  const [dayChecks, setDayChecks] = useState<DayCheckMap>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const zoned = useMemo(
    () => getZonedNow(schedule?.timezone || APP_TIMEZONE, nowTick),
    [schedule?.timezone, nowTick],
  )

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => subscribeStoreKpis(sigla, setKpis), [sigla])
  useEffect(() => subscribeCheckSchedule(sigla, setSchedule), [sigla])
  useEffect(
    () => subscribeDayChecks(sigla, zoned.monthKey, zoned.dayKey, setDayChecks),
    [sigla, zoned.monthKey, zoned.dayKey],
  )

  const activeKpis = useMemo(() => kpis.filter((k) => k.ativo !== false), [kpis])
  const inStatus = schedule ? evaluateWindow(schedule, 'checkIn', nowTick) : null
  const outStatus = schedule ? evaluateWindow(schedule, 'checkOut', nowTick) : null

  const draftKey = (target: Pick<LaunchTarget, 'kpiId' | 'subId' | 'tipo'>) =>
    `${target.kpiId}:${target.subId ?? '-'}:${target.tipo}`

  const currentValor = (kpiId: string, subId: string | undefined, tipo: CheckEntryTipo) => {
    const node = dayChecks[kpiId]
    if (!node) return null
    if (subId) return node.subs?.[subId]?.[tipo]?.valor ?? null
    return node[tipo]?.valor ?? null
  }

  const onSave = async (target: LaunchTarget) => {
    const key = draftKey(target)
    const raw = drafts[key]
    const valor = Number(String(raw ?? '').replace(',', '.'))
    if (!Number.isFinite(valor)) {
      setMessage('Informe um número válido.')
      return
    }
    const status = target.tipo === 'checkIn' ? inStatus : outStatus
    if (!status?.open) {
      setMessage(
        target.tipo === 'checkIn'
          ? 'Check-in fechado neste horário/dia.'
          : 'Check-out fechado neste horário/dia.',
      )
      return
    }
    setBusyKey(key)
    setMessage(null)
    try {
      await saveManagerCheckEntry({
        sigla,
        monthKey: zoned.monthKey,
        dayKey: zoned.dayKey,
        kpiId: target.kpiId,
        subId: target.subId,
        tipo: target.tipo,
        valor,
      })
      setMessage(`Salvo ${target.tipo === 'checkIn' ? 'IN' : 'OUT'} · ${target.label}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar lançamento.')
    } finally {
      setBusyKey(null)
    }
  }

  const renderLaunchRow = (target: LaunchTarget) => {
    const status = target.tipo === 'checkIn' ? inStatus : outStatus
    const key = draftKey(target)
    const atual = currentValor(target.kpiId, target.subId, target.tipo)
    return (
      <div key={key} className="perf-kpi-row">
        <div>
          <span className="perf-kpi-tipo">{target.tipo === 'checkIn' ? 'Check-in' : 'Check-out'}</span>
          <p className="perf-kpi-meta">Atual: {atual != null ? atual : '—'}</p>
        </div>
        <div className="perf-kpi-actions">
          <input
            type="text"
            inputMode="decimal"
            className="perf-num"
            placeholder="Valor"
            disabled={!status?.open || busyKey === key}
            value={drafts[key] ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
          />
          <button
            type="button"
            className="perf-btn perf-btn--primary"
            disabled={!status?.open || busyKey === key}
            onClick={() => void onSave(target)}
          >
            Salvar {target.tipo === 'checkIn' ? 'IN' : 'OUT'}
          </button>
        </div>
      </div>
    )
  }

  const renderIndicatorBody = (
    nome: string,
    kind: StoreKpi['kind'],
    checkIn: boolean,
    checkOut: boolean,
    formula: StoreKpi['formula'],
    kpiId: string,
    subId: string | undefined,
    cor: string,
  ) => {
    const hasLaunch = checkIn || checkOut
    return (
      <>
        <p className="perf-kpi-kind">
          {INDICATOR_KIND_SHORT[kind]}
          {kind === 'conversao' ? ` · ${formulaLabel(formula, kpis)}` : ''}
        </p>
        {!hasLaunch && kind === 'conversao' && (
          <p className="perf-kpi-meta">Calculado automaticamente — sem lançamento IN/OUT.</p>
        )}
        {!hasLaunch && kind !== 'conversao' && (
          <p className="perf-kpi-meta">IN/OUT desligados neste indicador.</p>
        )}
        {checkIn &&
          renderLaunchRow({
            key: `${kpiId}:${subId ?? '-'}:checkIn`,
            label: nome,
            kpiId,
            subId,
            tipo: 'checkIn',
            cor,
          })}
        {checkOut &&
          renderLaunchRow({
            key: `${kpiId}:${subId ?? '-'}:checkOut`,
            label: nome,
            kpiId,
            subId,
            tipo: 'checkOut',
            cor,
          })}
      </>
    )
  }

  return (
    <div className="perf-day">
      <section className="perf-card perf-status-row">
        <div>
          <p className="perf-eyebrow">Hoje · {zoned.dayKey}</p>
          <strong>
            {String(zoned.hour).padStart(2, '0')}:{String(zoned.minute).padStart(2, '0')} ·{' '}
            {schedule?.timezone || APP_TIMEZONE}
          </strong>
        </div>
        <div className="perf-window-badges">
          <span className={`perf-badge ${inStatus?.open ? 'is-open' : 'is-closed'}`}>
            IN · {inStatus?.label ?? '…'}
          </span>
          <span className={`perf-badge ${outStatus?.open ? 'is-open' : 'is-closed'}`}>
            OUT · {outStatus?.label ?? '…'}
          </span>
        </div>
      </section>

      {message && <p className="perf-toast">{message}</p>}

      {activeKpis.length === 0 ? (
        <section className="perf-card">
          <h2>Sem KPIs</h2>
          <p>Cadastre indicadores no painel (aba KPIs) para esta loja.</p>
        </section>
      ) : (
        <ul className="perf-kpi-list">
          {activeKpis.map((kpi) => {
            const activeSubs = (kpi.subs ?? []).filter((s: StoreKpiSub) => s.ativo !== false)
            return (
              <li key={kpi.id} className="perf-kpi-card" style={{ ['--kpi' as string]: kpi.cor }}>
                <header className="perf-kpi-head">
                  <span className="perf-kpi-dot" aria-hidden />
                  <h3>{kpi.nome}</h3>
                </header>
                {renderIndicatorBody(
                  kpi.nome,
                  kpi.kind,
                  kpi.checkIn,
                  kpi.checkOut,
                  kpi.formula,
                  kpi.id,
                  undefined,
                  kpi.cor,
                )}
                {activeSubs.length > 0 && (
                  <ul className="perf-sub-list">
                    {activeSubs.map((sub) => (
                      <li key={sub.id} className="perf-sub-card">
                        <h4>{sub.nome}</h4>
                        {renderIndicatorBody(
                          `${kpi.nome} → ${sub.nome}`,
                          sub.kind,
                          sub.checkIn,
                          sub.checkOut,
                          sub.formula,
                          kpi.id,
                          sub.id,
                          kpi.cor,
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

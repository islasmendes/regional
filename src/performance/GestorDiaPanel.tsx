import { useEffect, useMemo, useState } from 'react'
import { evaluateWindow, subscribeCheckSchedule } from '../firebase/checkSchedule'
import { subscribeStoreKpis } from '../firebase/kpis'
import {
  saveManagerCheckEntry,
  subscribeDayChecks,
  type DayCheckMap,
} from '../firebase/managerChecks'
import type { CheckScheduleConfig, StoreKpi } from '../firebase/types'
import { APP_TIMEZONE, getZonedNow } from '../lib/time'

type Props = {
  sigla: string
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

  const draftKey = (kpiId: string, tipo: 'checkIn' | 'checkOut') => `${kpiId}:${tipo}`

  const onSave = async (kpi: StoreKpi, tipo: 'checkIn' | 'checkOut') => {
    const key = draftKey(kpi.id, tipo)
    const raw = drafts[key]
    const valor = Number(String(raw ?? '').replace(',', '.'))
    if (!Number.isFinite(valor)) {
      setMessage('Informe um número válido.')
      return
    }
    const status = tipo === 'checkIn' ? inStatus : outStatus
    if (!status?.open) {
      setMessage(
        tipo === 'checkIn'
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
        kpiId: kpi.id,
        tipo,
        valor,
      })
      setMessage(`Salvo ${tipo === 'checkIn' ? 'IN' : 'OUT'} · ${kpi.nome}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar lançamento.')
    } finally {
      setBusyKey(null)
    }
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
            const inEntry = dayChecks[kpi.id]?.checkIn
            const outEntry = dayChecks[kpi.id]?.checkOut
            return (
              <li key={kpi.id} className="perf-kpi-card" style={{ ['--kpi' as string]: kpi.cor }}>
                <header className="perf-kpi-head">
                  <span className="perf-kpi-dot" aria-hidden />
                  <h3>{kpi.nome}</h3>
                </header>

                {kpi.checkIn && (
                  <div className="perf-kpi-row">
                    <div>
                      <span className="perf-kpi-tipo">Check-in</span>
                      <p className="perf-kpi-meta">
                        Atual: {inEntry?.valor != null ? inEntry.valor : '—'}
                      </p>
                    </div>
                    <div className="perf-kpi-actions">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="perf-num"
                        placeholder="Valor"
                        disabled={!inStatus?.open || busyKey === draftKey(kpi.id, 'checkIn')}
                        value={drafts[draftKey(kpi.id, 'checkIn')] ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [draftKey(kpi.id, 'checkIn')]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="perf-btn perf-btn--primary"
                        disabled={!inStatus?.open || busyKey === draftKey(kpi.id, 'checkIn')}
                        onClick={() => void onSave(kpi, 'checkIn')}
                      >
                        Salvar IN
                      </button>
                    </div>
                  </div>
                )}

                {kpi.checkOut && (
                  <div className="perf-kpi-row">
                    <div>
                      <span className="perf-kpi-tipo">Check-out</span>
                      <p className="perf-kpi-meta">
                        Atual: {outEntry?.valor != null ? outEntry.valor : '—'}
                      </p>
                    </div>
                    <div className="perf-kpi-actions">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="perf-num"
                        placeholder="Valor"
                        disabled={!outStatus?.open || busyKey === draftKey(kpi.id, 'checkOut')}
                        value={drafts[draftKey(kpi.id, 'checkOut')] ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [draftKey(kpi.id, 'checkOut')]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="perf-btn perf-btn--primary"
                        disabled={!outStatus?.open || busyKey === draftKey(kpi.id, 'checkOut')}
                        onClick={() => void onSave(kpi, 'checkOut')}
                      >
                        Salvar OUT
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

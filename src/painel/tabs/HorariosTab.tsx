import { useEffect, useMemo, useState } from 'react'
import {
  defaultCheckSchedule,
  saveCheckScheduleForStores,
  subscribeCheckSchedule,
} from '../../firebase/checkSchedule'
import type { CheckScheduleConfig, StoreMeta, TimeWindow } from '../../firebase/types'
import {
  STORE_SCOPE_ALL,
  canonicalSigla,
  isStoreScopeAll,
  resolveTargetSiglas,
  storeScopeLabel,
  type StoreScope,
} from '../../lib/storeScope'
import { WEEKDAY_LABELS } from '../../lib/time'
import { ThemeTimeField } from '../../ui/ThemeTimeField'
import { StoreScopeSelect } from '../StoreScopeSelect'

type Props = {
  stores: StoreMeta[]
}

export function HorariosTab({ stores }: Props) {
  const [scope, setScope] = useState<StoreScope>(STORE_SCOPE_ALL)
  const [draft, setDraft] = useState<CheckScheduleConfig>(() => defaultCheckSchedule())
  const [cloudStamp, setCloudStamp] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const targets = useMemo(() => resolveTargetSiglas(scope, stores), [scope, stores])
  const readSigla = useMemo(() => canonicalSigla(scope, stores), [scope, stores])
  const scopeText = storeScopeLabel(scope, targets.length)

  useEffect(() => {
    if (!readSigla) {
      setDraft(defaultCheckSchedule())
      return
    }
    return subscribeCheckSchedule(readSigla, (config) => {
      setDraft(config)
      setCloudStamp(config.updatedAt)
    })
  }, [readSigla])

  const setWindow = (tipo: 'checkIn' | 'checkOut', patch: Partial<TimeWindow>) => {
    setDraft((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ...patch },
    }))
    setMessage(null)
  }

  const toggleDay = (day: number) => {
    const key = String(day)
    setDraft((prev) => ({
      ...prev,
      weekdays: { ...prev.weekdays, [key]: !prev.weekdays[key] },
    }))
    setMessage(null)
  }

  const onSave = async () => {
    if (targets.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const saved = await saveCheckScheduleForStores(targets, draft)
      setDraft(saved)
      setCloudStamp(saved.updatedAt)
      setMessage(
        isStoreScopeAll(scope)
          ? `Agenda salva em todas as ${targets.length} lojas.`
          : `Agenda salva em ${scope}.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar horários.')
    } finally {
      setBusy(false)
    }
  }

  if (stores.length === 0) {
    return (
      <div className="painel-tab">
        <section className="painel-panel">
          <p className="painel-muted">Cadastre uma loja antes de definir a agenda.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="painel-tab">
      <section className="painel-panel">
        <StoreScopeSelect stores={stores} value={scope} onChange={setScope} />
      </section>

      <section className="painel-panel">
        <h3>Dias da semana</h3>
        <div className="horario-day-grid" role="group" aria-label="Dias da semana">
          {WEEKDAY_LABELS.map((day) => {
            const on = draft.weekdays[String(day.id)] === true
            return (
              <button
                key={day.id}
                type="button"
                className={`horario-day-card ${on ? 'is-on' : 'is-off'}`}
                aria-pressed={on}
                onClick={() => toggleDay(day.id)}
              >
                <span className="horario-day-short">{day.short}</span>
                <span className="horario-day-full">{day.full}</span>
                <span className="horario-day-state">{on ? 'Ativo' : 'Off'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="horario-window-grid">
        <section className="painel-panel horario-window-card horario-window-card--in">
          <header className="horario-window-head">
            <span className="horario-pill horario-pill--in">IN</span>
            <div>
              <h3>Check-in</h3>
              <p>Planejado do dia</p>
            </div>
          </header>
          <div className="painel-form--row">
            <ThemeTimeField
              label="Inicia"
              value={draft.checkIn.start}
              onChange={(start) => setWindow('checkIn', { start })}
            />
            <ThemeTimeField
              label="Encerra"
              value={draft.checkIn.end}
              onChange={(end) => setWindow('checkIn', { end })}
            />
          </div>
        </section>

        <section className="painel-panel horario-window-card horario-window-card--out">
          <header className="horario-window-head">
            <span className="horario-pill horario-pill--out">OUT</span>
            <div>
              <h3>Check-out</h3>
              <p>Realizado do dia</p>
            </div>
          </header>
          <div className="painel-form--row">
            <ThemeTimeField
              label="Inicia"
              value={draft.checkOut.start}
              onChange={(start) => setWindow('checkOut', { start })}
            />
            <ThemeTimeField
              label="Encerra"
              value={draft.checkOut.end}
              onChange={(end) => setWindow('checkOut', { end })}
            />
          </div>
        </section>
      </div>

      <section className="painel-panel">
        {message && <p className="painel-toast">{message}</p>}
        <p className="painel-muted">
          Fuso: <code>{draft.timezone}</code>
          {cloudStamp ? ` · última gravação ${new Date(cloudStamp).toLocaleString('pt-BR')}` : ''}
        </p>
        <div className="painel-store-actions" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="painel-btn painel-btn--primary"
            disabled={busy || targets.length === 0}
            onClick={() => void onSave()}
          >
            {busy ? 'Salvando…' : `Salvar agenda (${scopeText})`}
          </button>
        </div>
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'
import {
  defaultCheckSchedule,
  saveCheckSchedule,
  subscribeCheckSchedule,
} from '../../firebase/checkSchedule'
import type { CheckScheduleConfig, StoreMeta, TimeWindow } from '../../firebase/types'
import { WEEKDAY_LABELS } from '../../lib/time'

type Props = {
  stores: StoreMeta[]
}

export function HorariosTab({ stores }: Props) {
  const [sigla, setSigla] = useState(stores[0]?.code ?? '')
  const [draft, setDraft] = useState<CheckScheduleConfig>(() => defaultCheckSchedule())
  const [cloudStamp, setCloudStamp] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!sigla && stores[0]?.code) setSigla(stores[0].code)
  }, [stores, sigla])

  useEffect(() => {
    if (!sigla) {
      setDraft(defaultCheckSchedule())
      return
    }
    return subscribeCheckSchedule(sigla, (config) => {
      setDraft(config)
      setCloudStamp(config.updatedAt)
    })
  }, [sigla])

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
    if (!sigla) return
    setBusy(true)
    setMessage(null)
    try {
      const saved = await saveCheckSchedule(sigla, draft)
      setDraft(saved)
      setCloudStamp(saved.updatedAt)
      setMessage(`Agenda salva em stores/${sigla}/config/checkSchedule.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar horários.')
    } finally {
      setBusy(false)
    }
  }

  if (stores.length === 0) {
    return (
      <div className="painel-tab">
        <header className="painel-tab-head">
          <h2>Horários</h2>
          <p>Cadastre uma loja antes de definir a agenda de checks.</p>
        </header>
        <section className="painel-panel">
          <p className="painel-muted">
            Nenhuma loja em <code>stores/</code>.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="painel-tab">
      <header className="painel-tab-head">
        <h2>Horários</h2>
        <p>
          Janelas de abertura do check-in / check-out e dias ativos — por sigla, em{' '}
          <code>config/checkSchedule</code>.
        </p>
      </header>

      <section className="painel-panel">
        <label>
          Loja
          <select
            value={sigla}
            onChange={(e) => {
              setSigla(e.target.value)
              setMessage(null)
            }}
          >
            {stores.map((store) => (
              <option key={store.code} value={store.code}>
                {store.code}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="painel-panel">
        <h3>Dias da semana</h3>
        <p className="painel-hint" style={{ marginTop: 0 }}>
          Toque nos cards para ativar / desativar o dia.
        </p>
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
            <label>
              Inicia
              <input
                type="time"
                value={draft.checkIn.start}
                onChange={(e) => setWindow('checkIn', { start: e.target.value })}
                required
              />
            </label>
            <label>
              Encerra
              <input
                type="time"
                value={draft.checkIn.end}
                onChange={(e) => setWindow('checkIn', { end: e.target.value })}
                required
              />
            </label>
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
            <label>
              Inicia
              <input
                type="time"
                value={draft.checkOut.start}
                onChange={(e) => setWindow('checkOut', { start: e.target.value })}
                required
              />
            </label>
            <label>
              Encerra
              <input
                type="time"
                value={draft.checkOut.end}
                onChange={(e) => setWindow('checkOut', { end: e.target.value })}
                required
              />
            </label>
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
            disabled={busy || !sigla}
            onClick={() => void onSave()}
          >
            {busy ? 'Salvando…' : 'Salvar agenda da loja'}
          </button>
        </div>
      </section>
    </div>
  )
}

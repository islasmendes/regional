import { useMemo, useState } from 'react'
import {
  atingimento,
  crescimentoRelativo,
  formatPlain,
  formatSigned,
  parseLocaleNumber,
  pontosPercentuais,
  toneFromSigned,
  type ResultTone,
} from '../lib/calcMetrics'
import './CalculadorasPanel.css'

type InputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function InputCell({ label, value, onChange, placeholder }: InputProps) {
  return (
    <label className="calc-input-cell">
      <span className="calc-input-label">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        autoComplete="off"
      />
    </label>
  )
}

type KpiCardProps = {
  id: string
  label: string
  value: string
  tone?: ResultTone
  sub?: string
}

function KpiCard({ label, value, tone = 'neutral', sub }: KpiCardProps) {
  return (
    <article className={`calc-kpi calc-kpi--${tone}`}>
      <span className="calc-kpi-label">{label}</span>
      <strong className="calc-kpi-value">{value}</strong>
      {sub ? <span className="calc-kpi-sub">{sub}</span> : null}
    </article>
  )
}

/** Normal: ≥100% bom. Inverso (menor=melhor): ≥100% = estourou a meta. */
function toneMetaRatio(ratioPct: number | null, inverso: boolean): ResultTone {
  if (ratioPct === null) return 'neutral'
  if (inverso) {
    if (ratioPct <= 100) return 'positive'
    if (ratioPct <= 105) return 'warn'
    return 'negative'
  }
  if (ratioPct >= 100) return 'positive'
  if (ratioPct >= 95) return 'warn'
  return 'negative'
}

/** Resultados de um bloco Meta / Real / YoY. */
function buildBlockCards(opts: {
  prefix: string
  meta: number | null
  real: number | null
  yoy: number | null
  mode: 'pct' | 'abs'
  inverso: boolean
}): KpiCardProps[] {
  const { prefix, meta, real, yoy, mode, inverso } = opts
  if (meta === null || real === null) return []

  const ratio = atingimento(real, meta)
  const variacao = mode === 'pct' ? pontosPercentuais(real, meta) : real - meta
  const cresc = crescimentoRelativo(real, meta)
  const varSuffix = mode === 'pct' ? ' p.p.' : ''

  const out: KpiCardProps[] = [
    {
      id: `${prefix}-att`,
      label: inverso ? 'Estouro' : 'Atingimento',
      value: ratio === null ? '—' : formatPlain(ratio, 1, '%'),
      tone: toneMetaRatio(ratio, inverso),
      sub: inverso ? 'Real ÷ Meta · menor = melhor' : 'Real ÷ Meta',
    },
    {
      id: `${prefix}-var`,
      label: 'Variação',
      value: formatSigned(variacao, 2, varSuffix),
      tone: toneFromSigned(variacao, inverso),
      sub: mode === 'pct' ? 'Real − Meta (p.p.)' : 'Real − Meta (nº)',
    },
    {
      id: `${prefix}-cresc`,
      label: 'Crescimento',
      value: cresc === null ? '—' : formatSigned(cresc, 2, '%'),
      tone: toneFromSigned(cresc, inverso),
      sub: '(Real − Meta) ÷ Meta',
    },
  ]

  if (yoy !== null) {
    const varYoY = mode === 'pct' ? pontosPercentuais(real, yoy) : real - yoy
    const crescYoY = crescimentoRelativo(real, yoy)
    out.push(
      {
        id: `${prefix}-var-yoy`,
        label: 'Variação YoY',
        value: formatSigned(varYoY, 2, varSuffix),
        tone: toneFromSigned(varYoY, inverso),
        sub: mode === 'pct' ? 'Real − Ano ant. (p.p.)' : 'Real − Ano ant. (nº)',
      },
      {
        id: `${prefix}-cresc-yoy`,
        label: 'Crescimento YoY',
        value: crescYoY === null ? '—' : formatSigned(crescYoY, 2, '%'),
        tone: toneFromSigned(crescYoY, inverso),
        sub: '(Real − Ano ant.) ÷ Ano ant.',
      },
    )
  }

  return out
}

export function CalculadorasPanel() {
  const [inverso, setInverso] = useState(false)
  const [metaPct, setMetaPct] = useState('55')
  const [realPct, setRealPct] = useState('53.8')
  const [yoyPct, setYoyPct] = useState('')
  const [metaAbs, setMetaAbs] = useState('')
  const [realAbs, setRealAbs] = useState('')
  const [yoyAbs, setYoyAbs] = useState('')

  const pctCards = useMemo(
    () =>
      buildBlockCards({
        prefix: 'pct',
        meta: parseLocaleNumber(metaPct),
        real: parseLocaleNumber(realPct),
        yoy: parseLocaleNumber(yoyPct),
        mode: 'pct',
        inverso,
      }),
    [metaPct, realPct, yoyPct, inverso],
  )

  const absCards = useMemo(
    () =>
      buildBlockCards({
        prefix: 'abs',
        meta: parseLocaleNumber(metaAbs),
        real: parseLocaleNumber(realAbs),
        yoy: parseLocaleNumber(yoyAbs),
        mode: 'abs',
        inverso,
      }),
    [metaAbs, realAbs, yoyAbs, inverso],
  )

  const hasAny = pctCards.length > 0 || absCards.length > 0

  return (
    <div className="calc-panel">
      <div className="calc-toolbar">
        <button
          type="button"
          className={`calc-toggle ${inverso ? 'is-on' : ''}`}
          onClick={() => setInverso((v) => !v)}
          aria-pressed={inverso}
        >
          <span className="calc-toggle-dot" aria-hidden />
          Inverso
          <span className="calc-toggle-hint">
            {inverso ? 'quanto menor, melhor' : 'quanto maior, melhor'}
          </span>
        </button>
      </div>

      <section className="calc-bar" aria-label="Entradas">
        <div className="calc-bar-group">
          <span className="calc-bar-title">Percentual</span>
          <div className="calc-bar-fields calc-bar-fields--3">
            <InputCell label="Meta %" value={metaPct} onChange={setMetaPct} placeholder="55" />
            <InputCell label="Real %" value={realPct} onChange={setRealPct} placeholder="53,8" />
            <InputCell label="YoY %" value={yoyPct} onChange={setYoyPct} placeholder="50" />
          </div>
        </div>

        <div className="calc-bar-group">
          <span className="calc-bar-title">Número absoluto</span>
          <div className="calc-bar-fields calc-bar-fields--3">
            <InputCell label="Meta nº" value={metaAbs} onChange={setMetaAbs} placeholder="5" />
            <InputCell label="Real nº" value={realAbs} onChange={setRealAbs} placeholder="10" />
            <InputCell label="YoY nº" value={yoyAbs} onChange={setYoyAbs} placeholder="8" />
          </div>
        </div>
      </section>

      {!hasAny ? (
        <p className="calc-empty">Preencha Meta e Real (%) ou (nº) pra ver o resultado.</p>
      ) : (
        <div className="calc-blocks">
          {pctCards.length > 0 && (
            <section className="calc-block" aria-label="Resultados percentuais">
              <h2 className="calc-block-title">Resultados %</h2>
              <div className="calc-kpi-grid">
                {pctCards.map((card) => (
                  <KpiCard key={card.id} {...card} />
                ))}
              </div>
            </section>
          )}

          {absCards.length > 0 && (
            <section className="calc-block" aria-label="Resultados absolutos">
              <h2 className="calc-block-title">Resultados nº</h2>
              <div className="calc-kpi-grid">
                {absCards.map((card) => (
                  <KpiCard key={card.id} {...card} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

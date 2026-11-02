import { useMemo, useState } from 'react'
import {
  atingimento,
  crescimentoRelativo,
  formatPlain,
  formatSigned,
  gapAbsoluto,
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
  hint?: string
}

function InputCell({ label, value, onChange, placeholder, hint }: InputProps) {
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
      {hint ? <span className="calc-input-hint">{hint}</span> : null}
    </label>
  )
}

type KpiCardProps = {
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

function formatIntish(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('pt-BR')
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function CalculadorasPanel() {
  const [metaPct, setMetaPct] = useState('55')
  const [realPct, setRealPct] = useState('53.8')
  const [metaAbs, setMetaAbs] = useState('')
  const [realAbs, setRealAbs] = useState('')
  const [baseTaxa, setBaseTaxa] = useState('')

  const cards = useMemo(() => {
    const mPct = parseLocaleNumber(metaPct)
    const rPct = parseLocaleNumber(realPct)
    const mAbs = parseLocaleNumber(metaAbs)
    const rAbs = parseLocaleNumber(realAbs)
    const base = parseLocaleNumber(baseTaxa)

    const out: KpiCardProps[] = []

    if (mPct !== null && rPct !== null) {
      const att = atingimento(rPct, mPct)
      const pp = pontosPercentuais(rPct, mPct)
      const cresc = crescimentoRelativo(rPct, mPct)

      out.push({
        label: 'Atingimento',
        value: att === null ? '—' : formatPlain(att, 1, '%'),
        tone: att === null ? 'neutral' : att >= 100 ? 'positive' : att >= 95 ? 'warn' : 'negative',
        sub: 'Real % ÷ Meta %',
      })
      out.push({
        label: 'Variação',
        value: formatSigned(pp, 2, ' p.p.'),
        tone: toneFromSigned(pp),
        sub: 'pontos percentuais',
      })
      out.push({
        label: 'Crescimento',
        value: cresc === null ? '—' : formatSigned(cresc, 2, '%'),
        tone: toneFromSigned(cresc),
        sub: 'relativo à meta',
      })
      out.push({
        label: 'Falta / sobra',
        value: formatSigned(mPct - rPct, 2, ' p.p.'),
        tone: mPct - rPct > 0 ? 'warn' : 'positive',
        sub: mPct - rPct > 0 ? 'ainda falta pra meta' : 'acima da meta',
      })
    }

    if (mAbs !== null && rAbs !== null) {
      const attAbs = atingimento(rAbs, mAbs)
      const gap = gapAbsoluto(rAbs, mAbs)
      const crescAbs = crescimentoRelativo(rAbs, mAbs)

      out.push({
        label: 'Atingimento (nº)',
        value: attAbs === null ? '—' : formatPlain(attAbs, 1, '%'),
        tone:
          attAbs === null ? 'neutral' : attAbs >= 100 ? 'positive' : attAbs >= 95 ? 'warn' : 'negative',
        sub: 'Real ÷ Meta',
      })
      out.push({
        label: 'Gap absoluto',
        value: formatSigned(gap, 2),
        tone: toneFromSigned(gap),
        sub: `${formatIntish(rAbs)} vs ${formatIntish(mAbs)}`,
      })
      out.push({
        label: 'Crescimento (nº)',
        value: crescAbs === null ? '—' : formatSigned(crescAbs, 2, '%'),
        tone: toneFromSigned(crescAbs),
        sub: 'relativo à meta numérica',
      })
      out.push({
        label: 'Falta (nº)',
        value: formatSigned(mAbs - rAbs, 2),
        tone: mAbs - rAbs > 0 ? 'warn' : 'positive',
        sub: mAbs - rAbs > 0 ? 'volume que falta' : 'acima da meta',
      })
    }

    if (base !== null && rPct !== null) {
      const ppYoY = pontosPercentuais(rPct, base)
      const crescYoY = crescimentoRelativo(rPct, base)
      out.push({
        label: 'vs base (p.p.)',
        value: formatSigned(ppYoY, 2, ' p.p.'),
        tone: toneFromSigned(ppYoY),
        sub: 'variação em pontos',
      })
      out.push({
        label: 'vs base (%)',
        value: crescYoY === null ? '—' : formatSigned(crescYoY, 2, '%'),
        tone: toneFromSigned(crescYoY),
        sub: 'crescimento relativo',
      })
    }

    if (mPct !== null && base !== null) {
      const metaVsBasePp = pontosPercentuais(mPct, base)
      const metaVsBaseCresc = crescimentoRelativo(mPct, base)
      out.push({
        label: 'Meta vs base',
        value: formatSigned(metaVsBasePp, 2, ' p.p.'),
        tone: toneFromSigned(metaVsBasePp),
        sub:
          metaVsBaseCresc === null
            ? 'ambição da meta'
            : `${formatSigned(metaVsBaseCresc, 1, '%')} relativo`,
      })
    }

    return out
  }, [metaPct, realPct, metaAbs, realAbs, baseTaxa])

  return (
    <div className="calc-panel">
      <section className="calc-bar" aria-label="Entradas">
        <div className="calc-bar-group">
          <span className="calc-bar-title">%</span>
          <div className="calc-bar-fields">
            <InputCell label="Meta %" value={metaPct} onChange={setMetaPct} placeholder="55" />
            <InputCell label="Real %" value={realPct} onChange={setRealPct} placeholder="53,8" />
          </div>
        </div>

        <div className="calc-bar-group">
          <span className="calc-bar-title">Nº</span>
          <div className="calc-bar-fields">
            <InputCell label="Meta nº" value={metaAbs} onChange={setMetaAbs} placeholder="1000" />
            <InputCell label="Real nº" value={realAbs} onChange={setRealAbs} placeholder="920" />
          </div>
        </div>

        <div className="calc-bar-group">
          <span className="calc-bar-title">Base</span>
          <div className="calc-bar-fields">
            <InputCell
              label="Ano ant. / base %"
              value={baseTaxa}
              onChange={setBaseTaxa}
              placeholder="50"
              hint="opcional · YoY"
            />
          </div>
        </div>
      </section>

      {cards.length === 0 ? (
        <p className="calc-empty">Preencha Meta % e Real % (ou os números) pra ver o resultado.</p>
      ) : (
        <section className="calc-kpi-grid" aria-label="Resultados">
          {cards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </section>
      )}
    </div>
  )
}

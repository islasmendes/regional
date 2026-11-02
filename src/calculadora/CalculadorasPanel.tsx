import { useMemo, useState } from 'react'
import {
  atingimento,
  cagr,
  conversao,
  crescimentoRelativo,
  formatPlain,
  formatSigned,
  gapAbsoluto,
  metaParaAtingimento,
  parseLocaleNumber,
  participacao,
  pontosPercentuais,
  projecaoPercentual,
  realParaAtingimento,
  ritmoNecessarioDiario,
  toneFromSigned,
  type CalcResult,
} from '../lib/calcMetrics'
import './CalculadorasPanel.css'

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  suffix?: string
}

function Field({ label, value, onChange, placeholder, suffix }: FieldProps) {
  return (
    <label>
      {label}
      {suffix ? ` (${suffix})` : ''}
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '0'}
        autoComplete="off"
      />
    </label>
  )
}

function Results({ items, empty }: { items: CalcResult[]; empty: string }) {
  if (items.length === 0) {
    return <p className="calc-empty">{empty}</p>
  }
  return (
    <div className="calc-results">
      {items.map((item) => (
        <article
          key={item.id}
          className={`calc-result calc-result--${item.tone ?? 'neutral'}`}
        >
          <span className="calc-result-label">{item.label}</span>
          <strong className="calc-result-value">{item.value}</strong>
          {item.hint && <span className="calc-result-hint">{item.hint}</span>}
        </article>
      ))}
    </div>
  )
}

function MetaRealAnoCard() {
  const [meta, setMeta] = useState('55')
  const [real, setReal] = useState('53.8')
  const [anoAnterior, setAnoAnterior] = useState('')

  const items = useMemo(() => {
    const m = parseLocaleNumber(meta)
    const r = parseLocaleNumber(real)
    const a = parseLocaleNumber(anoAnterior)
    if (m === null || r === null) return []

    const att = atingimento(r, m)
    const varPpMeta = pontosPercentuais(r, m)
    const crescMeta = crescimentoRelativo(r, m)
    const gap = gapAbsoluto(r, m)
    const out: CalcResult[] = [
      {
        id: 'atingimento',
        label: 'Atingimento da meta',
        value: att === null ? '—' : formatPlain(att, 2, '%'),
        hint: 'Real ÷ Meta × 100',
        tone: att === null ? 'neutral' : att >= 100 ? 'positive' : att >= 95 ? 'warn' : 'negative',
      },
      {
        id: 'var-pp-meta',
        label: 'Variação vs meta (p.p.)',
        value: formatSigned(varPpMeta, 2, ' p.p.'),
        hint: 'Real − Meta — diferença em pontos percentuais',
        tone: toneFromSigned(varPpMeta),
      },
      {
        id: 'cresc-meta',
        label: 'Crescimento vs meta (%)',
        value: crescMeta === null ? 'indefinido (meta 0)' : formatSigned(crescMeta, 2, '%'),
        hint: '(Real − Meta) ÷ |Meta| × 100 — variação relativa',
        tone: toneFromSigned(crescMeta),
      },
      {
        id: 'gap-meta',
        label: 'Gap absoluto vs meta',
        value: formatSigned(gap, 2),
        hint: 'Mesma unidade do input (ex.: pontos de conversão)',
        tone: toneFromSigned(gap),
      },
      {
        id: 'falta-pp',
        label: 'Quanto falta para a meta',
        value: formatSigned(m - r, 2, ' p.p.'),
        hint: 'Meta − Real (positivo = ainda falta)',
        tone: m - r > 0 ? 'warn' : 'positive',
      },
    ]

    if (a !== null) {
      const varPpAno = pontosPercentuais(r, a)
      const crescAno = crescimentoRelativo(r, a)
      const metaVsAnoPp = pontosPercentuais(m, a)
      const metaVsAnoCresc = crescimentoRelativo(m, a)
      out.push(
        {
          id: 'var-pp-ano',
          label: 'Variação YoY (p.p.)',
          value: formatSigned(varPpAno, 2, ' p.p.'),
          hint: 'Real − Ano anterior',
          tone: toneFromSigned(varPpAno),
        },
        {
          id: 'cresc-ano',
          label: 'Crescimento YoY (%)',
          value: crescAno === null ? 'indefinido (base 0)' : formatSigned(crescAno, 2, '%'),
          hint: '(Real − Ano ant.) ÷ |Ano ant.| × 100',
          tone: toneFromSigned(crescAno),
        },
        {
          id: 'meta-vs-ano-pp',
          label: 'Meta vs ano ant. (p.p.)',
          value: formatSigned(metaVsAnoPp, 2, ' p.p.'),
          hint: 'Quão agressiva é a meta frente ao ano passado',
          tone: toneFromSigned(metaVsAnoPp),
        },
        {
          id: 'meta-vs-ano-cresc',
          label: 'Meta vs ano ant. (%)',
          value:
            metaVsAnoCresc === null
              ? 'indefinido (base 0)'
              : formatSigned(metaVsAnoCresc, 2, '%'),
          hint: 'Crescimento embutido na meta',
          tone: toneFromSigned(metaVsAnoCresc),
        },
      )
    }

    return out
  }, [meta, real, anoAnterior])

  return (
    <section id="meta-real" className="painel-panel calc-card">
      <div>
        <h2>Meta × Real × Ano anterior</h2>
        <p>
          Preencha meta e real; o ano anterior libera YoY. Entrega variação em p.p. e
          crescimento relativo de uma vez.
        </p>
      </div>
      <div className="calc-fields">
        <Field label="Meta" value={meta} onChange={setMeta} placeholder="55" suffix="%" />
        <Field label="Real" value={real} onChange={setReal} placeholder="53,8" suffix="%" />
        <Field
          label="Ano anterior"
          value={anoAnterior}
          onChange={setAnoAnterior}
          placeholder="opcional"
          suffix="%"
        />
      </div>
      <Results items={items} empty="Informe meta e real para calcular." />
    </section>
  )
}

function DoisPeriodosCard() {
  const [base, setBase] = useState('100')
  const [atual, setAtual] = useState('120')

  const items = useMemo(() => {
    const b = parseLocaleNumber(base)
    const a = parseLocaleNumber(atual)
    if (b === null || a === null) return []
    const delta = gapAbsoluto(a, b)
    const cresc = crescimentoRelativo(a, b)
    const indice = b === 0 ? null : (a / b) * 100
    return [
      {
        id: 'delta',
        label: 'Variação absoluta',
        value: formatSigned(delta, 2),
        hint: 'Atual − Base',
        tone: toneFromSigned(delta),
      },
      {
        id: 'cresc',
        label: 'Crescimento / variação relativa',
        value: cresc === null ? 'indefinido (base 0)' : formatSigned(cresc, 2, '%'),
        hint: '(Atual − Base) ÷ |Base| × 100',
        tone: toneFromSigned(cresc),
      },
      {
        id: 'indice',
        label: 'Índice (base = 100)',
        value: indice === null ? '—' : formatPlain(indice, 2),
        hint: 'Atual ÷ Base × 100',
        tone: indice === null ? 'neutral' : indice >= 100 ? 'positive' : 'negative',
      },
      {
        id: 'mult',
        label: 'Multiplicador',
        value: b === 0 ? '—' : formatPlain(a / b, 3, '×'),
        hint: 'Atual ÷ Base',
        tone: 'neutral',
      },
    ] satisfies CalcResult[]
  }, [base, atual])

  return (
    <section id="dois-periodos" className="painel-panel calc-card">
      <div>
        <h2>Dois períodos (volume)</h2>
        <p>Vendas, leads, tickets — comparação entre base e atual.</p>
      </div>
      <div className="calc-fields">
        <Field label="Base / anterior" value={base} onChange={setBase} />
        <Field label="Atual" value={atual} onChange={setAtual} />
      </div>
      <Results items={items} empty="Informe base e atual." />
    </section>
  )
}

function TaxasCard() {
  const [de, setDe] = useState('50')
  const [para, setPara] = useState('55')

  const items = useMemo(() => {
    const a = parseLocaleNumber(de)
    const b = parseLocaleNumber(para)
    if (a === null || b === null) return []
    const pp = pontosPercentuais(b, a)
    const cresc = crescimentoRelativo(b, a)
    return [
      {
        id: 'pp',
        label: 'Variação (pontos percentuais)',
        value: formatSigned(pp, 2, ' p.p.'),
        hint: 'Para − De — use para taxas já em %',
        tone: toneFromSigned(pp),
      },
      {
        id: 'cresc',
        label: 'Crescimento relativo',
        value: cresc === null ? 'indefinido (base 0)' : formatSigned(cresc, 2, '%'),
        hint: 'Ex.: 50% → 55% = +5 p.p. e +10% de crescimento',
        tone: toneFromSigned(cresc),
      },
    ] satisfies CalcResult[]
  }, [de, para])

  return (
    <section id="taxas" className="painel-panel calc-card">
      <div>
        <h2>Taxa → taxa (p.p. × crescimento)</h2>
        <p>Deixa explícita a diferença entre variação em p.p. e crescimento %.</p>
      </div>
      <div className="calc-fields">
        <Field label="De" value={de} onChange={setDe} suffix="%" />
        <Field label="Para" value={para} onChange={setPara} suffix="%" />
      </div>
      <Results items={items} empty="Informe as duas taxas." />
    </section>
  )
}

function RitmoCard() {
  const [meta, setMeta] = useState('1000')
  const [real, setReal] = useState('420')
  const [decorridos, setDecorridos] = useState('12')
  const [diasMes, setDiasMes] = useState('30')

  const items = useMemo(() => {
    const m = parseLocaleNumber(meta)
    const r = parseLocaleNumber(real)
    const d = parseLocaleNumber(decorridos)
    const dm = parseLocaleNumber(diasMes)
    if (m === null || r === null || d === null || dm === null) return []
    const proj = projecaoPercentual(r, m, d, dm)
    const restante = dm - d
    const ritmoAtual = d <= 0 ? null : r / d
    const ritmoMeta = ritmoNecessarioDiario(r, m, restante)
    const att = atingimento(r, m)
    return [
      {
        id: 'att',
        label: 'Atingimento atual',
        value: att === null ? '—' : formatPlain(att, 2, '%'),
        hint: 'Real ÷ Meta',
        tone: att === null ? 'neutral' : att >= 100 ? 'positive' : 'warn',
      },
      {
        id: 'proj',
        label: 'Projeção linear (Proj%)',
        value: proj === null ? '—' : formatPlain(proj, 2, '%'),
        hint: 'Extrapolação do ritmo atual até o fim do mês',
        tone:
          proj === null ? 'neutral' : proj >= 100 ? 'positive' : proj >= 90 ? 'warn' : 'negative',
      },
      {
        id: 'ritmo-atual',
        label: 'Ritmo atual / dia',
        value: ritmoAtual === null ? '—' : formatPlain(ritmoAtual, 2),
        hint: 'Real ÷ dias decorridos',
        tone: 'neutral',
      },
      {
        id: 'ritmo-meta',
        label: 'Ritmo necessário / dia',
        value:
          ritmoMeta === null
            ? '—'
            : formatSigned(ritmoMeta, 2),
        hint: '(Meta − Real) ÷ dias restantes',
        tone: ritmoMeta === null ? 'neutral' : ritmoMeta <= 0 ? 'positive' : 'warn',
      },
      {
        id: 'restante',
        label: 'Dias restantes',
        value: formatPlain(restante, 0),
        tone: restante < 0 ? 'negative' : 'neutral',
      },
    ] satisfies CalcResult[]
  }, [meta, real, decorridos, diasMes])

  return (
    <section id="ritmo" className="painel-panel calc-card">
      <div>
        <h2>Ritmo / projeção no mês</h2>
        <p>Mesma lógica da matriz: Proj% e quanto precisa fazer por dia.</p>
      </div>
      <div className="calc-fields">
        <Field label="Meta do mês" value={meta} onChange={setMeta} />
        <Field label="Real acumulado" value={real} onChange={setReal} />
        <Field label="Dias decorridos" value={decorridos} onChange={setDecorridos} />
        <Field label="Dias do mês" value={diasMes} onChange={setDiasMes} />
      </div>
      <Results items={items} empty="Preencha meta, real e dias." />
    </section>
  )
}

function ConversaoCard() {
  const [num, setNum] = useState('48')
  const [den, setDen] = useState('120')

  const items = useMemo(() => {
    const n = parseLocaleNumber(num)
    const d = parseLocaleNumber(den)
    if (n === null || d === null) return []
    const conv = conversao(n, d)
    const faltam = d - n
    return [
      {
        id: 'conv',
        label: 'Conversão',
        value: conv === null ? '—' : formatPlain(conv, 2, '%'),
        hint: 'Numerador ÷ Denominador × 100',
        tone: 'neutral',
      },
      {
        id: 'razao',
        label: 'Razão',
        value: d === 0 ? '—' : formatPlain(n / d, 4),
        hint: 'Numerador ÷ Denominador',
        tone: 'neutral',
      },
      {
        id: 'gap',
        label: 'Diferença absoluta',
        value: formatSigned(faltam, 2),
        hint: 'Denominador − Numerador',
        tone: 'neutral',
      },
    ] satisfies CalcResult[]
  }, [num, den])

  return (
    <section id="conversao" className="painel-panel calc-card">
      <div>
        <h2>Conversão (A ÷ B)</h2>
        <p>Agendamentos / leads, vendas / visitas, etc.</p>
      </div>
      <div className="calc-fields">
        <Field label="Numerador (A)" value={num} onChange={setNum} />
        <Field label="Denominador (B)" value={den} onChange={setDen} />
      </div>
      <Results items={items} empty="Informe A e B." />
    </section>
  )
}

function AtingimentoInversoCard() {
  const [meta, setMeta] = useState('1000')
  const [real, setReal] = useState('850')
  const [alvoAtt, setAlvoAtt] = useState('100')

  const items = useMemo(() => {
    const m = parseLocaleNumber(meta)
    const r = parseLocaleNumber(real)
    const alvo = parseLocaleNumber(alvoAtt)
    if (m === null || r === null || alvo === null) return []
    const realPrecisa = realParaAtingimento(m, alvo)
    const metaEquiv = metaParaAtingimento(r, alvo)
    return [
      {
        id: 'real-precisa',
        label: `Real para ${formatPlain(alvo, 0)}% da meta`,
        value: formatPlain(realPrecisa, 2),
        hint: 'Meta × (atingimento desejado ÷ 100)',
        tone: r >= realPrecisa ? 'positive' : 'warn',
      },
      {
        id: 'falta-real',
        label: 'Falta no real',
        value: formatSigned(realPrecisa - r, 2),
        hint: 'Quanto ainda precisa lançar',
        tone: toneFromSigned(realPrecisa - r, true),
      },
      {
        id: 'meta-equiv',
        label: `Meta equivalente ao real @ ${formatPlain(alvo, 0)}%`,
        value: metaEquiv === null ? '—' : formatPlain(metaEquiv, 2),
        hint: 'Qual meta faria o real atual valer o atingimento desejado',
        tone: 'neutral',
      },
    ] satisfies CalcResult[]
  }, [meta, real, alvoAtt])

  return (
    <section id="inverso" className="painel-panel calc-card">
      <div>
        <h2>Meta / real necessários</h2>
        <p>Inverso do atingimento: quanto precisa fazer (ou que meta caberia).</p>
      </div>
      <div className="calc-fields">
        <Field label="Meta" value={meta} onChange={setMeta} />
        <Field label="Real atual" value={real} onChange={setReal} />
        <Field label="Atingimento desejado" value={alvoAtt} onChange={setAlvoAtt} suffix="%" />
      </div>
      <Results items={items} empty="Preencha os três campos." />
    </section>
  )
}

function ParticipacaoCard() {
  const [parte, setParte] = useState('180')
  const [todo, setTodo] = useState('900')

  const items = useMemo(() => {
    const p = parseLocaleNumber(parte)
    const t = parseLocaleNumber(todo)
    if (p === null || t === null) return []
    const share = participacao(p, t)
    return [
      {
        id: 'share',
        label: 'Participação / mix',
        value: share === null ? '—' : formatPlain(share, 2, '%'),
        hint: 'Parte ÷ Todo × 100',
        tone: 'neutral',
      },
      {
        id: 'resto',
        label: 'Restante do todo',
        value: formatPlain(t - p, 2),
        hint: 'Todo − Parte',
        tone: 'neutral',
      },
    ] satisfies CalcResult[]
  }, [parte, todo])

  return (
    <section id="participacao" className="painel-panel calc-card">
      <div>
        <h2>Participação / share</h2>
        <p>Peso da loja no regional, canal no mix, etc.</p>
      </div>
      <div className="calc-fields">
        <Field label="Parte" value={parte} onChange={setParte} />
        <Field label="Todo" value={todo} onChange={setTodo} />
      </div>
      <Results items={items} empty="Informe parte e todo." />
    </section>
  )
}

function CagrCard() {
  const [inicial, setInicial] = useState('100')
  const [final, setFinal] = useState('161')
  const [periodos, setPeriodos] = useState('3')

  const items = useMemo(() => {
    const i = parseLocaleNumber(inicial)
    const f = parseLocaleNumber(final)
    const n = parseLocaleNumber(periodos)
    if (i === null || f === null || n === null) return []
    const rate = cagr(i, f, n)
    const total = crescimentoRelativo(f, i)
    return [
      {
        id: 'cagr',
        label: 'CAGR (ao período)',
        value: rate === null ? '—' : formatSigned(rate, 2, '%'),
        hint: '(Final ÷ Inicial)^(1/n) − 1',
        tone: toneFromSigned(rate),
      },
      {
        id: 'total',
        label: 'Crescimento total no intervalo',
        value: total === null ? '—' : formatSigned(total, 2, '%'),
        hint: '(Final − Inicial) ÷ |Inicial|',
        tone: toneFromSigned(total),
      },
    ] satisfies CalcResult[]
  }, [inicial, final, periodos])

  return (
    <section id="cagr" className="painel-panel calc-card">
      <div>
        <h2>CAGR / crescimento composto</h2>
        <p>Média composta entre N períodos (anos, trimestres…).</p>
      </div>
      <div className="calc-fields">
        <Field label="Valor inicial" value={inicial} onChange={setInicial} />
        <Field label="Valor final" value={final} onChange={setFinal} />
        <Field label="Nº de períodos" value={periodos} onChange={setPeriodos} />
      </div>
      <Results items={items} empty="Informe inicial, final e períodos." />
    </section>
  )
}

const NAV_LINKS = [
  { href: '#meta-real', label: 'Meta × Real' },
  { href: '#taxas', label: 'p.p. × crescimento' },
  { href: '#dois-periodos', label: 'Dois períodos' },
  { href: '#ritmo', label: 'Ritmo / Proj%' },
  { href: '#conversao', label: 'Conversão' },
  { href: '#inverso', label: 'Meta necessária' },
  { href: '#participacao', label: 'Share' },
  { href: '#cagr', label: 'CAGR' },
  { href: '#ideias', label: 'Próximas' },
] as const

export function CalculadorasPanel() {
  return (
    <div className="calc-panel">
      <section className="painel-panel calc-glossary">
        <div>
          <h2>Crescimento ≠ variação</h2>
          <p>
            Quando os números já são porcentagens, a mesma mudança tem dois nomes. Use os dois —
            nunca misture.
          </p>
        </div>
        <div className="calc-glossary-grid">
          <article className="calc-glossary-item">
            <strong>Variação (p.p.)</strong>
            Diferença absoluta entre duas taxas. Meta 55% e real 53,8% →{' '}
            <em>−1,2 ponto percentual</em>.
            <code>variação = real − meta</code>
          </article>
          <article className="calc-glossary-item">
            <strong>Crescimento (%)</strong>
            Mudança relativa sobre a base. Os mesmos −1,2 p.p. sobre 55% → cerca de{' '}
            <em>−2,18% de crescimento</em>.
            <code>crescimento = (real − meta) ÷ |meta| × 100</code>
          </article>
        </div>
        <nav className="calc-nav" aria-label="Atalhos das calculadoras">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </section>

      <div className="calc-grid">
        <MetaRealAnoCard />
        <TaxasCard />
        <DoisPeriodosCard />
        <RitmoCard />
        <ConversaoCard />
        <AtingimentoInversoCard />
        <ParticipacaoCard />
        <CagrCard />
      </div>

      <section id="ideias" className="painel-panel calc-ideas">
        <h2>Outras calculadoras possíveis</h2>
        <p className="calc-hint">
          Já entram nesta página as mais usadas no regional. Candidatas fortes para a próxima
          rodada:
        </p>
        <ul>
          <li>
            <strong>Break-even de conversão</strong> — quantos leads extras para bater a meta de
            vendas com a taxa atual.
          </li>
          <li>
            <strong>Acuracidade planejado × realizado</strong> — |IN − OUT| / IN (já prevista na
            evolução do app).
          </li>
          <li>
            <strong>Elasticidade preço / volume</strong> — impacto percentual de uma mudança de
            preço.
          </li>
          <li>
            <strong>Target diário regressivo</strong> — curva de meta restante por dia útil
            (calendário da loja).
          </li>
          <li>
            <strong>Comparativo multi-loja</strong> — cola N pares meta/real e ranqueia gap e YoY.
          </li>
          <li>
            <strong>NPS / alvo</strong> — distância ao alvo e contribuição de promotores vs
            detratores.
          </li>
        </ul>
      </section>
    </div>
  )
}

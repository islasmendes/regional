import type { StoreMeta } from '../../firebase/types'
import type { PainelTabId } from './registry'

type Props = {
  stores: StoreMeta[]
  onOpenTab: (id: PainelTabId) => void
}

export function InicioTab({ stores, onOpenTab }: Props) {
  return (
    <div className="painel-tab">
      <header className="painel-tab-head">
        <h2>Início</h2>
        <p>Painel loja-cêntrico — cada sigla isola meta, KPIs, checks e resultados por mês.</p>
      </header>

      <section className="painel-panel">
        <div className="painel-stat-grid">
          <article className="painel-stat">
            <span className="painel-stat-label">Lojas</span>
            <strong className="painel-stat-value">{stores.length}</strong>
          </article>
          <article className="painel-stat">
            <span className="painel-stat-label">Isolamento</span>
            <strong className="painel-stat-value">por sigla</strong>
          </article>
        </div>
        <p className="painel-hint">
          Estrutura: <code>stores/{'{SIGLA}'}/meta|kpis|managerChecks/{'{mês}'}|results/{'{mês}'}</code>
        </p>
        <div className="painel-store-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="painel-btn painel-btn--primary" onClick={() => onOpenTab('lojas')}>
            Gerenciar lojas
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={() => onOpenTab('kpis')}>
            KPIs por loja
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={() => onOpenTab('abas')}>
            Organizar abas
          </button>
        </div>
      </section>

      {stores.length > 0 && (
        <section className="painel-panel">
          <h3>Siglas ativas</h3>
          <ul className="painel-chip-list">
            {stores.map((store) => (
              <li key={store.code} className="painel-chip">
                {store.code}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

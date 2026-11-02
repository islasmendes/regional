import type { StoreMeta } from '../../firebase/types'
import type { PainelTabId } from './registry'

type Props = {
  stores: StoreMeta[]
  onOpenTab: (id: PainelTabId) => void
}

export function InicioTab({ stores, onOpenTab }: Props) {
  return (
    <div className="painel-tab">
      <section className="painel-panel">
        <div className="painel-stat-grid">
          <article className="painel-stat">
            <span className="painel-stat-label">Lojas</span>
            <strong className="painel-stat-value">{stores.length}</strong>
          </article>
          <article className="painel-stat">
            <span className="painel-stat-label">Ativas</span>
            <strong className="painel-stat-value">
              {stores.filter((s) => s.active !== false).length}
            </strong>
          </article>
        </div>
        <div className="painel-store-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="painel-btn painel-btn--primary" onClick={() => onOpenTab('lojas')}>
            Lojas
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={() => onOpenTab('kpis')}>
            KPIs
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={() => onOpenTab('horarios')}>
            Horários
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={() => onOpenTab('matriz')}>
            Matriz
          </button>
          <button
            type="button"
            className="painel-btn painel-btn--ghost"
            onClick={() => onOpenTab('calculadora')}
          >
            Calculadora
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={() => onOpenTab('abas')}>
            Abas
          </button>
        </div>
      </section>

      {stores.length > 0 && (
        <section className="painel-panel">
          <h3>Siglas</h3>
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

import { Link } from 'react-router-dom'
import { database } from '../firebase/config'
import './PerformancePage.css'

/**
 * Placeholder do app do gestor.
 * Ordem: primeiro o /painel (lojas) → depois auth e check-in/out aqui.
 */
export function PerformancePage() {
  const dbHost = database.app.options.databaseURL ?? '—'

  return (
    <main className="perf-shell">
      <header className="perf-brand">
        <span className="perf-mark" aria-hidden>
          RA
        </span>
        <div>
          <h1>Regional Alta Performance</h1>
          <p>Input do gestor — check-in e check-out da loja</p>
        </div>
      </header>

      <section className="perf-card" aria-label="Status">
        <h2>Aguardando etapa do gestor</h2>
        <p>
          O caminho <code>/performance</code> existe, mas o fluxo de login/lançamento ainda não
          foi ligado. Antes, cadastre lojas no painel.
        </p>
        <ul>
          <li>
            Firebase: <strong>regionalaltaperformance</strong>
          </li>
          <li>
            RTDB: <code>{dbHost}</code>
          </li>
          <li>
            Agora: <Link to="/painel">abrir o painel</Link> e criar lojas
          </li>
        </ul>
      </section>
    </main>
  )
}

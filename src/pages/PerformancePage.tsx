import { database } from '../firebase/config'
import './PerformancePage.css'

/**
 * Etapa 1 — placeholder do app do gestor.
 * Próximas etapas: auth (sigla + senha) → check-in/out → sync RTDB.
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

      <section className="perf-card" aria-label="Status da base">
        <h2>Base pronta</h2>
        <p>
          Este é o ponto de entrada <code>/performance</code>. Ainda sem login nem
          lançamentos — só a fundação do app.
        </p>
        <ul>
          <li>
            Firebase: <strong>regionalaltaperformance</strong>
          </li>
          <li>
            RTDB: <code>{dbHost}</code>
          </li>
          <li>Próximo: autenticação do gestor (sigla da loja + senha)</li>
        </ul>
      </section>
    </main>
  )
}

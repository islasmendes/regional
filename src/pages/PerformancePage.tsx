import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useGestorAuth } from '../auth/GestorAuthContext'
import { GestorDiaPanel } from '../performance/GestorDiaPanel'
import './PerformancePage.css'

export function PerformancePage() {
  const { ready, isAuthenticated, session, login, logout, lastError, clearError } = useGestorAuth()
  const [sigla, setSigla] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onLogin = async (event: FormEvent) => {
    event.preventDefault()
    clearError()
    setMessage(null)
    setBusy(true)
    try {
      await login(sigla, password)
      setPassword('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha no login.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <main className="perf-shell">
        <p className="perf-muted">Conectando…</p>
      </main>
    )
  }

  if (!isAuthenticated || !session) {
    return (
      <main className="perf-shell perf-shell--auth">
        <section className="perf-card perf-auth-card">
          <header className="perf-brand">
            <span className="perf-mark" aria-hidden>
              RA
            </span>
            <div>
              <h1>Regional Alta Performance</h1>
              <p>App do gestor — check-in e check-out da loja</p>
            </div>
          </header>

          <form className="perf-form" onSubmit={(e) => void onLogin(e)}>
            <label>
              Sigla da loja
              <input
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                placeholder="Ex.: VCANT"
                autoComplete="organization"
                required
              />
            </label>
            <label>
              Senha da loja
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha cadastrada no painel"
                autoComplete="current-password"
                minLength={6}
                required
              />
            </label>
            {(message || lastError) && (
              <p className="perf-error" role="alert">
                {message || lastError}
              </p>
            )}
            <button type="submit" className="perf-btn perf-btn--primary" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="perf-muted">
            Ainda não tem loja? Cadastre no <Link to="/painel">painel</Link>.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="perf-shell">
      <header className="perf-top">
        <div className="perf-brand">
          <span className="perf-mark" aria-hidden>
            RA
          </span>
          <div>
            <h1>Loja {session.sigla}</h1>
            <p>Lançamento do dia · check-in / check-out</p>
          </div>
        </div>
        <button type="button" className="perf-btn perf-btn--ghost" onClick={() => void logout()}>
          Sair
        </button>
      </header>

      <GestorDiaPanel sigla={session.sigla} />
    </main>
  )
}

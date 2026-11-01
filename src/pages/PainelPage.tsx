import { useEffect, useState, type FormEvent } from 'react'
import { useMasterAuth } from '../auth/MasterAuthContext'
import {
  createStore,
  deleteStore,
  subscribeStores,
  updateStorePassword,
} from '../firebase/stores'
import type { StoreMeta } from '../firebase/types'
import { normalizeSigla } from '../lib/sigla'
import './PainelPage.css'

export function PainelPage() {
  const { ready, isAuthenticated, login, logout, lastError, clearError } = useMasterAuth()
  const [password, setPassword] = useState('')
  const [busyAuth, setBusyAuth] = useState(false)
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  const [stores, setStores] = useState<StoreMeta[]>([])
  const [storesError, setStoresError] = useState<string | null>(null)

  const [sigla, setSigla] = useState('')
  const [storePassword, setStorePassword] = useState('')
  const [busyStore, setBusyStore] = useState(false)
  const [storeMessage, setStoreMessage] = useState<string | null>(null)

  const [resetSigla, setResetSigla] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      setStores([])
      return
    }
    setStoresError(null)
    const unsubscribe = subscribeStores(setStores)
    return unsubscribe
  }, [isAuthenticated])

  const onLogin = async (event: FormEvent) => {
    event.preventDefault()
    clearError()
    setAuthMessage(null)
    setBusyAuth(true)
    try {
      await login(password)
      setPassword('')
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Falha no login.')
    } finally {
      setBusyAuth(false)
    }
  }

  const onCreateStore = async (event: FormEvent) => {
    event.preventDefault()
    setStoreMessage(null)
    setBusyStore(true)
    try {
      const created = await createStore(sigla, storePassword)
      setStoreMessage(`Loja ${created.code} criada.`)
      setSigla('')
      setStorePassword('')
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Falha ao criar loja.')
    } finally {
      setBusyStore(false)
    }
  }

  const onDeleteStore = async (code: string) => {
    const confirmed = window.confirm(
      `Excluir a loja ${code}? Isso remove os dados dela no RTDB.`,
    )
    if (!confirmed) return
    setStoreMessage(null)
    setBusyStore(true)
    try {
      await deleteStore(code)
      setStoreMessage(`Loja ${code} excluída.`)
      if (resetSigla === code) {
        setResetSigla(null)
        setResetPassword('')
      }
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Falha ao excluir loja.')
    } finally {
      setBusyStore(false)
    }
  }

  const onResetPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!resetSigla) return
    setStoreMessage(null)
    setBusyStore(true)
    try {
      await updateStorePassword(resetSigla, resetPassword)
      setStoreMessage(`Senha da loja ${resetSigla} atualizada.`)
      setResetSigla(null)
      setResetPassword('')
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Falha ao atualizar senha.')
    } finally {
      setBusyStore(false)
    }
  }

  if (!ready) {
    return (
      <main className="painel-shell">
        <p className="painel-muted">Conectando…</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="painel-shell painel-shell--auth">
        <section className="painel-auth-card">
          <header className="painel-brand">
            <span className="painel-mark" aria-hidden>
              RA
            </span>
            <div>
              <h1>Painel Regional</h1>
              <p>Admin — cadastro de lojas e acesso mestre</p>
            </div>
          </header>
          <form className="painel-form" onSubmit={onLogin}>
            <label>
              Senha mestra
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="current-password"
                minLength={6}
                required
              />
            </label>
            <p className="painel-hint">
              No primeiro acesso, esta senha cria a conta mestra na nuvem. Depois, use a mesma
              para entrar.
            </p>
            {(authMessage || lastError) && (
              <p className="painel-error" role="alert">
                {authMessage || lastError}
              </p>
            )}
            <button type="submit" className="painel-btn painel-btn--primary" disabled={busyAuth}>
              {busyAuth ? 'Entrando…' : 'Entrar no painel'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="painel-shell">
      <header className="painel-top">
        <div className="painel-brand">
          <span className="painel-mark" aria-hidden>
            RA
          </span>
          <div>
            <h1>Painel Regional</h1>
            <p>Lojas · base para o app do gestor</p>
          </div>
        </div>
        <button type="button" className="painel-btn painel-btn--ghost" onClick={() => void logout()}>
          Sair
        </button>
      </header>

      <section className="painel-panel">
        <h2>Nova loja</h2>
        <form className="painel-form painel-form--row" onSubmit={onCreateStore}>
          <label>
            Sigla
            <input
              value={sigla}
              onChange={(e) => setSigla(normalizeSigla(e.target.value))}
              placeholder="Ex.: VCANT"
              autoComplete="off"
              required
            />
          </label>
          <label>
            Senha do gestor
            <input
              type="password"
              value={storePassword}
              onChange={(e) => setStorePassword(e.target.value)}
              placeholder="Mín. 6 caracteres"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="painel-btn painel-btn--primary" disabled={busyStore}>
            {busyStore ? 'Salvando…' : 'Criar loja'}
          </button>
        </form>
        <p className="painel-hint">
          Padrão de sigla: <strong>VC…</strong>. A senha será usada depois em{' '}
          <code>/performance</code>.
        </p>
      </section>

      <section className="painel-panel">
        <div className="painel-panel-head">
          <h2>Lojas cadastradas</h2>
          <span className="painel-count">{stores.length}</span>
        </div>
        {storesError && <p className="painel-error">{storesError}</p>}
        {storeMessage && <p className="painel-toast">{storeMessage}</p>}
        {stores.length === 0 ? (
          <p className="painel-muted">Nenhuma loja ainda. Crie a primeira acima.</p>
        ) : (
          <ul className="painel-store-list">
            {stores.map((store) => (
              <li key={store.code} className="painel-store-item">
                <div>
                  <strong>{store.code}</strong>
                  <span className="painel-muted">
                    {store.active ? 'ativa' : 'inativa'} · criada{' '}
                    {new Date(store.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="painel-store-actions">
                  <button
                    type="button"
                    className="painel-btn painel-btn--ghost"
                    disabled={busyStore}
                    onClick={() => {
                      setResetSigla(store.code)
                      setResetPassword('')
                    }}
                  >
                    Redefinir senha
                  </button>
                  <button
                    type="button"
                    className="painel-btn painel-btn--danger"
                    disabled={busyStore}
                    onClick={() => void onDeleteStore(store.code)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {resetSigla && (
          <form className="painel-form painel-reset" onSubmit={onResetPassword}>
            <h3>Nova senha — {resetSigla}</h3>
            <label>
              Senha
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                minLength={6}
                required
                autoFocus
              />
            </label>
            <div className="painel-store-actions">
              <button type="submit" className="painel-btn painel-btn--primary" disabled={busyStore}>
                Salvar senha
              </button>
              <button
                type="button"
                className="painel-btn painel-btn--ghost"
                onClick={() => {
                  setResetSigla(null)
                  setResetPassword('')
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

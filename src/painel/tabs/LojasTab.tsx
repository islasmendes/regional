import { useState, type FormEvent } from 'react'
import {
  createStore,
  deleteStore,
  formatStoreSummary,
  reconcileStoreIndex,
  updateStorePassword,
} from '../../firebase/stores'
import type { StoreMeta } from '../../firebase/types'
import { normalizeSigla } from '../../lib/sigla'

type Props = {
  stores: StoreMeta[]
}

export function LojasTab({ stores }: Props) {
  const [sigla, setSigla] = useState('')
  const [storePassword, setStorePassword] = useState('')
  const [busyStore, setBusyStore] = useState(false)
  const [storeMessage, setStoreMessage] = useState<string | null>(null)
  const [resetSigla, setResetSigla] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const onCreateStore = async (event: FormEvent) => {
    event.preventDefault()
    setStoreMessage(null)
    setBusyStore(true)
    try {
      const result = await createStore(sigla, storePassword)
      if (result.recovered) {
        setStoreMessage(
          `Sigla ${result.store.code} reativada sem apagar histórico (${formatStoreSummary(result.summary)}). Mês sem lançamento continua em branco na matriz.`,
        )
      } else {
        setStoreMessage(`Loja ${result.store.code} criada.`)
      }
      setSigla('')
      setStorePassword('')
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Falha ao criar loja.')
    } finally {
      setBusyStore(false)
    }
  }

  const onRepairIndex = async () => {
    setStoreMessage(null)
    setBusyStore(true)
    try {
      const { repaired, codes } = await reconcileStoreIndex()
      if (repaired.length === 0) {
        setStoreMessage(
          `Índice ok · ${codes.length} sigla(s) no cadastro. Nenhuma órfã encontrada.`,
        )
      } else {
        setStoreMessage(
          `Recuperadas ${repaired.length} sigla(s) órfã(s): ${repaired.join(', ')}. KPIs/metas/reais preservados.`,
        )
      }
    } catch (error) {
      setStoreMessage(error instanceof Error ? error.message : 'Falha ao reparar índice.')
    } finally {
      setBusyStore(false)
    }
  }

  const onDeleteStore = async (code: string) => {
    const confirmed = window.confirm(
      `Excluir a loja ${code} e TODOS os dados dela (KPIs, metas, reais, checks)?`,
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

  return (
    <div className="painel-tab">
      <section className="painel-panel">
        <h3>Nova loja</h3>
        <p className="painel-muted">
          Se a sigla já existir no Firebase (órfã do índice), o formulário reativa a loja e
          preserva KPIs, metas e reais por mês. Mês sem dado fica em branco.
        </p>
        <form className="painel-form painel-form--row" onSubmit={(e) => void onCreateStore(e)}>
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
            {busyStore ? 'Salvando…' : 'Criar / recuperar'}
          </button>
        </form>
      </section>

      <section className="painel-panel">
        <div className="painel-panel-head">
          <h3>Cadastradas</h3>
          <span className="painel-count">{stores.length}</span>
        </div>
        <div className="painel-store-actions" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="painel-btn painel-btn--ghost"
            disabled={busyStore}
            onClick={() => void onRepairIndex()}
            title="Reatacha no índice lojas que ainda existem em stores/ mas sumiram da lista"
          >
            Reparar cadastros
          </button>
        </div>
        {storeMessage && <p className="painel-toast">{storeMessage}</p>}
        {stores.length === 0 ? (
          <p className="painel-muted">Nenhuma loja ainda.</p>
        ) : (
          <ul className="painel-store-list">
            {stores.map((store) => (
              <li key={store.code} className="painel-store-item">
                <div>
                  <strong>{store.code}</strong>
                  <span className="painel-muted">{store.active ? 'ativa' : 'inativa'}</span>
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
          <form className="painel-form painel-reset" onSubmit={(e) => void onResetPassword(e)}>
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
    </div>
  )
}

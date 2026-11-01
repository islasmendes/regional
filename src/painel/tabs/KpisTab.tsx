import { useEffect, useState, type FormEvent } from 'react'
import {
  createStoreKpi,
  defaultKpiColor,
  deleteStoreKpi,
  moveStoreKpi,
  subscribeStoreKpis,
  updateStoreKpi,
} from '../../firebase/kpis'
import type { StoreKpi, StoreMeta } from '../../firebase/types'

type Props = {
  stores: StoreMeta[]
}

type Draft = {
  nome: string
  cor: string
  checkIn: boolean
  checkOut: boolean
}

const emptyDraft = (): Draft => ({
  nome: '',
  cor: defaultKpiColor(0),
  checkIn: true,
  checkOut: true,
})

export function KpisTab({ stores }: Props) {
  const [sigla, setSigla] = useState(stores[0]?.code ?? '')
  const [kpis, setKpis] = useState<StoreKpi[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!sigla && stores[0]?.code) setSigla(stores[0].code)
  }, [stores, sigla])

  useEffect(() => {
    if (!sigla) {
      setKpis([])
      return
    }
    return subscribeStoreKpis(sigla, setKpis)
  }, [sigla])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!sigla) return
    setBusy(true)
    setMessage(null)
    try {
      if (editingId) {
        await updateStoreKpi(sigla, editingId, draft)
        setMessage(`KPI atualizado em stores/${sigla}/kpis/${editingId}.`)
      } else {
        const created = await createStoreKpi(sigla, draft)
        setMessage(`KPI ${created.nome} criado em stores/${sigla}/kpis/.`)
      }
      setDraft(emptyDraft())
      setEditingId(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar KPI.')
    } finally {
      setBusy(false)
    }
  }

  const onEdit = (kpi: StoreKpi) => {
    setEditingId(kpi.id)
    setDraft({
      nome: kpi.nome,
      cor: kpi.cor,
      checkIn: kpi.checkIn,
      checkOut: kpi.checkOut,
    })
    setMessage(null)
  }

  const onCancelEdit = () => {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  const onDelete = async (kpi: StoreKpi) => {
    if (!sigla) return
    const ok = window.confirm(`Excluir o KPI "${kpi.nome}" da loja ${sigla}?`)
    if (!ok) return
    setBusy(true)
    setMessage(null)
    try {
      await deleteStoreKpi(sigla, kpi.id)
      if (editingId === kpi.id) onCancelEdit()
      setMessage(`KPI ${kpi.nome} removido.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao excluir KPI.')
    } finally {
      setBusy(false)
    }
  }

  const onMove = async (kpi: StoreKpi, direction: 'up' | 'down') => {
    if (!sigla) return
    setBusy(true)
    setMessage(null)
    try {
      await moveStoreKpi(sigla, kpi.id, direction)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao reordenar.')
    } finally {
      setBusy(false)
    }
  }

  if (stores.length === 0) {
    return (
      <div className="painel-tab">
        <header className="painel-tab-head">
          <h2>KPIs</h2>
          <p>Cadastre uma loja antes de criar indicadores.</p>
        </header>
        <section className="painel-panel">
          <p className="painel-muted">
            Nenhuma loja em <code>stores/</code>. Vá na aba Lojas.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="painel-tab">
      <header className="painel-tab-head">
        <h2>KPIs</h2>
        <p>
          Indicadores isolados por sigla em <code>stores/{'{SIGLA}'}/kpis/</code>. Defina se o
          gestor lança check-in e/ou check-out.
        </p>
      </header>

      <section className="painel-panel">
        <label>
          Loja
          <select
            value={sigla}
            onChange={(e) => {
              setSigla(e.target.value)
              onCancelEdit()
              setMessage(null)
            }}
          >
            {stores.map((store) => (
              <option key={store.code} value={store.code}>
                {store.code}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="painel-panel">
        <h3>{editingId ? 'Editar KPI' : 'Novo KPI'}</h3>
        <form className="painel-form" onSubmit={(e) => void onSubmit(e)}>
          <div className="painel-form--row">
            <label>
              Nome
              <input
                value={draft.nome}
                onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                placeholder="Ex.: Vendas faturadas"
                required
                minLength={2}
              />
            </label>
            <label>
              Cor
              <input
                type="color"
                value={draft.cor}
                onChange={(e) => setDraft((d) => ({ ...d, cor: e.target.value }))}
              />
            </label>
          </div>
          <div className="painel-kpi-flags">
            <label className="painel-check">
              <input
                type="checkbox"
                checked={draft.checkIn}
                onChange={(e) => setDraft((d) => ({ ...d, checkIn: e.target.checked }))}
              />
              Check-in (IN / planejado)
            </label>
            <label className="painel-check">
              <input
                type="checkbox"
                checked={draft.checkOut}
                onChange={(e) => setDraft((d) => ({ ...d, checkOut: e.target.checked }))}
              />
              Check-out (OUT / realizado)
            </label>
          </div>
          <div className="painel-store-actions">
            <button type="submit" className="painel-btn painel-btn--primary" disabled={busy || !sigla}>
              {busy ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar KPI'}
            </button>
            {editingId && (
              <button type="button" className="painel-btn painel-btn--ghost" onClick={onCancelEdit}>
                Cancelar
              </button>
            )}
          </div>
        </form>
        {message && <p className="painel-toast">{message}</p>}
      </section>

      <section className="painel-panel">
        <div className="painel-panel-head">
          <h3>Indicadores — {sigla || '—'}</h3>
          <span className="painel-count">{kpis.length}</span>
        </div>
        {kpis.length === 0 ? (
          <p className="painel-muted">Nenhum KPI nesta loja ainda.</p>
        ) : (
          <ul className="painel-store-list">
            {kpis.map((kpi, index) => (
              <li key={kpi.id} className="painel-store-item">
                <div className="painel-kpi-item-main">
                  <span className="painel-kpi-swatch" style={{ background: kpi.cor }} aria-hidden />
                  <div>
                    <strong>{kpi.nome}</strong>
                    <span className="painel-muted">
                      {kpi.checkIn ? 'IN' : '—'} · {kpi.checkOut ? 'OUT' : '—'} ·{' '}
                      <code>{kpi.id}</code>
                    </span>
                  </div>
                </div>
                <div className="painel-store-actions">
                  <button
                    type="button"
                    className="painel-btn painel-btn--ghost"
                    disabled={busy || index === 0}
                    onClick={() => void onMove(kpi, 'up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="painel-btn painel-btn--ghost"
                    disabled={busy || index === kpis.length - 1}
                    onClick={() => void onMove(kpi, 'down')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="painel-btn painel-btn--ghost"
                    disabled={busy}
                    onClick={() => onEdit(kpi)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="painel-btn painel-btn--danger"
                    disabled={busy}
                    onClick={() => void onDelete(kpi)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

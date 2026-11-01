import { useEffect, useState } from 'react'
import { moveTabOrder, saveTabsConfig } from '../../firebase/uiTabs'
import type { PainelTabsConfig } from '../../firebase/types'
import { PAINEL_TAB_REGISTRY, type PainelTabId } from './registry'

type Props = {
  config: PainelTabsConfig
}

const GROUP_OPTIONS = ['geral', 'cadastros', 'sistema', 'operacao', 'relatorios'] as const

export function AbasTab({ config }: Props) {
  const [draft, setDraft] = useState<PainelTabsConfig>(config)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft(config)
  }, [config])

  const byId = Object.fromEntries(PAINEL_TAB_REGISTRY.map((t) => [t.id, t]))

  const onMove = (id: PainelTabId, direction: 'up' | 'down') => {
    setDraft((prev) => ({ ...prev, order: moveTabOrder(prev.order, id, direction) }))
    setMessage(null)
  }

  const onToggle = (id: PainelTabId) => {
    setDraft((prev) => ({
      ...prev,
      enabled: { ...prev.enabled, [id]: !(prev.enabled[id] ?? true) },
    }))
    setMessage(null)
  }

  const onGroup = (id: PainelTabId, group: string) => {
    setDraft((prev) => ({
      ...prev,
      groups: { ...prev.groups, [id]: group },
    }))
    setMessage(null)
  }

  const onSave = async () => {
    setBusy(true)
    setMessage(null)
    try {
      // Início e Abas não podem sumir da navegação raiz.
      const enabled = {
        ...draft.enabled,
        inicio: true,
        abas: true,
      }
      await saveTabsConfig({ ...draft, enabled })
      setMessage('Ordem das abas salva na raiz (master/ui/tabs).')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar abas.')
    } finally {
      setBusy(false)
    }
  }

  const onReset = () => {
    setDraft(config)
    setMessage(null)
  }

  return (
    <div className="painel-tab">
      <header className="painel-tab-head">
        <h2>Abas</h2>
        <p>
          Reorganize a sidebar na raiz. Depois dá para classificar/ordenar com mais abas (matriz,
          KPIs, etc.).
        </p>
      </header>

      <section className="painel-panel">
        <ol className="painel-tabs-editor">
          {draft.order.map((id, index) => {
            const def = byId[id]
            if (!def) return null
            const enabled = draft.enabled[id] ?? def.defaultEnabled
            const group = draft.groups[id] ?? def.group
            const locked = id === 'inicio' || id === 'abas'
            return (
              <li key={id} className="painel-tabs-editor-item">
                <div className="painel-tabs-editor-main">
                  <span className="painel-tabs-editor-pos">{index + 1}</span>
                  <div>
                    <strong>{def.label}</strong>
                    <span className="painel-muted">{def.description}</span>
                  </div>
                </div>
                <div className="painel-tabs-editor-controls">
                  <label className="painel-check">
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={locked}
                      onChange={() => onToggle(id)}
                    />
                    Visível
                  </label>
                  <label>
                    Grupo
                    <select value={group} onChange={(e) => onGroup(id, e.target.value)}>
                      {GROUP_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="painel-btn painel-btn--ghost"
                    disabled={index === 0}
                    onClick={() => onMove(id, 'up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="painel-btn painel-btn--ghost"
                    disabled={index === draft.order.length - 1}
                    onClick={() => onMove(id, 'down')}
                  >
                    ↓
                  </button>
                </div>
              </li>
            )
          })}
        </ol>

        {message && <p className="painel-toast">{message}</p>}

        <div className="painel-store-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="painel-btn painel-btn--primary"
            disabled={busy}
            onClick={() => void onSave()}
          >
            {busy ? 'Salvando…' : 'Salvar ordem na raiz'}
          </button>
          <button type="button" className="painel-btn painel-btn--ghost" onClick={onReset}>
            Desfazer
          </button>
        </div>
      </section>
    </div>
  )
}

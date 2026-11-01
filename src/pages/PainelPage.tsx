import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMasterAuth } from '../auth/MasterAuthContext'
import { subscribeStores } from '../firebase/stores'
import type { PainelTabsConfig, StoreMeta } from '../firebase/types'
import { defaultTabsConfig, subscribeTabsConfig } from '../firebase/uiTabs'
import { AbasTab } from '../painel/tabs/AbasTab'
import { InicioTab } from '../painel/tabs/InicioTab'
import { LojasTab } from '../painel/tabs/LojasTab'
import {
  PAINEL_TAB_REGISTRY,
  type PainelTabId,
} from '../painel/tabs/registry'
import './PainelPage.css'

const TAB_STORAGE_KEY = 'regional-painel-active-tab'

function readStoredTab(): PainelTabId {
  const raw = localStorage.getItem(TAB_STORAGE_KEY)
  if (raw === 'inicio' || raw === 'lojas' || raw === 'abas') return raw
  return 'inicio'
}

export function PainelPage() {
  const { ready, isAuthenticated, login, logout, lastError, clearError } = useMasterAuth()
  const [password, setPassword] = useState('')
  const [busyAuth, setBusyAuth] = useState(false)
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  const [stores, setStores] = useState<StoreMeta[]>([])
  const [tabsConfig, setTabsConfig] = useState<PainelTabsConfig>(() => defaultTabsConfig())
  const [activeTab, setActiveTab] = useState<PainelTabId>(() => readStoredTab())
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setStores([])
      return
    }
    const unsubStores = subscribeStores(setStores)
    const unsubTabs = subscribeTabsConfig(setTabsConfig)
    return () => {
      unsubStores()
      unsubTabs()
    }
  }, [isAuthenticated])

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  const visibleTabs = useMemo(() => {
    const byId = Object.fromEntries(PAINEL_TAB_REGISTRY.map((t) => [t.id, t]))
    return tabsConfig.order
      .map((id) => byId[id])
      .filter((tab): tab is (typeof PAINEL_TAB_REGISTRY)[number] => {
        if (!tab) return false
        const enabled = tabsConfig.enabled[tab.id] ?? tab.defaultEnabled
        return enabled
      })
  }, [tabsConfig])

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab) && visibleTabs[0]) {
      setActiveTab(visibleTabs[0].id)
    }
  }, [visibleTabs, activeTab])

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
              <p>Admin — lojas isoladas por sigla</p>
            </div>
          </header>
          <form className="painel-form" onSubmit={(e) => void onLogin(e)}>
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
              No primeiro acesso, esta senha cria a conta mestra na nuvem.
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

  const activeDef = PAINEL_TAB_REGISTRY.find((t) => t.id === activeTab)

  return (
    <div className={`painel-app ${sidebarOpen ? '' : 'painel-app--sidebar-collapsed'}`}>
      <aside className="painel-sidebar" aria-label="Navegação do painel">
        <div className="painel-sidebar-brand">
          <span className="painel-mark" aria-hidden>
            RA
          </span>
          {sidebarOpen && (
            <div>
              <strong>Regional</strong>
              <span>Painel</span>
            </div>
          )}
        </div>

        <nav className="painel-sidebar-nav">
          {visibleTabs.map((tab) => {
            const group = tabsConfig.groups[tab.id] ?? tab.group
            return (
              <button
                key={tab.id}
                type="button"
                className={`painel-nav-item ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={`${tab.label} · ${group}`}
              >
                <span className="painel-nav-dot" aria-hidden />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="painel-sidebar-foot">
          <button
            type="button"
            className="painel-btn painel-btn--ghost painel-sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? '◂' : '▸'}
          </button>
          {sidebarOpen && (
            <button type="button" className="painel-btn painel-btn--ghost" onClick={() => void logout()}>
              Sair
            </button>
          )}
        </div>
      </aside>

      <div className="painel-main">
        <header className="painel-top">
          <div>
            <p className="painel-eyebrow">{tabsConfig.groups[activeTab] ?? activeDef?.group}</p>
            <h1>{activeDef?.label ?? 'Painel'}</h1>
          </div>
        </header>

        <div className="painel-main-body">
          {activeTab === 'inicio' && <InicioTab stores={stores} onOpenTab={setActiveTab} />}
          {activeTab === 'lojas' && <LojasTab stores={stores} />}
          {activeTab === 'abas' && (
            <AbasTab key={tabsConfig.updatedAt} config={tabsConfig} />
          )}
        </div>
      </div>
    </div>
  )
}

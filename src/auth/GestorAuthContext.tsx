import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import {
  explainGestorAuthError,
  loginGestor,
  logoutGestor,
  readGestorSession,
  subscribeGestorAuth,
  type GestorSession,
} from '../firebase/gestorAuth'
import { masterEmail } from '../firebase/paths'

type GestorAuthState = {
  ready: boolean
  user: User | null
  session: GestorSession | null
  isAuthenticated: boolean
  login: (sigla: string, password: string) => Promise<void>
  logout: () => Promise<void>
  lastError: string | null
  clearError: () => void
}

const GestorAuthContext = createContext<GestorAuthState | null>(null)

function isGestorUser(user: User | null, session: GestorSession | null): boolean {
  if (!user?.email || !session) return false
  if (user.email === masterEmail()) return false
  return user.email === session.authEmail
}

export function GestorAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<GestorSession | null>(() => readGestorSession())
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeGestorAuth((next) => {
        setUser(next)
        const stored = readGestorSession()
        if (!next || !isGestorUser(next, stored)) {
          if (stored && (!next || next.email === masterEmail())) {
            // Sessão mestra no mesmo browser não vale como gestor.
            setSession(null)
          } else {
            setSession(isGestorUser(next, stored) ? stored : null)
          }
        } else {
          setSession(stored)
        }
        setReady(true)
      }),
    [],
  )

  const login = useCallback(async (sigla: string, password: string) => {
    setLastError(null)
    try {
      const next = await loginGestor(sigla, password)
      setSession(next)
    } catch (error) {
      const message = explainGestorAuthError(error)
      setLastError(message)
      throw new Error(message)
    }
  }, [])

  const logout = useCallback(async () => {
    setLastError(null)
    await logoutGestor()
    setSession(null)
  }, [])

  const value = useMemo<GestorAuthState>(
    () => ({
      ready,
      user,
      session,
      isAuthenticated: isGestorUser(user, session),
      login,
      logout,
      lastError,
      clearError: () => setLastError(null),
    }),
    [ready, user, session, login, logout, lastError],
  )

  return <GestorAuthContext.Provider value={value}>{children}</GestorAuthContext.Provider>
}

export function useGestorAuth(): GestorAuthState {
  const ctx = useContext(GestorAuthContext)
  if (!ctx) throw new Error('useGestorAuth deve ser usado dentro de GestorAuthProvider.')
  return ctx
}

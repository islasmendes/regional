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
  explainAuthError,
  loginMaster,
  logoutMaster,
  subscribeAuth,
} from '../firebase/masterAuth'

type MasterAuthState = {
  ready: boolean
  user: User | null
  isAuthenticated: boolean
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
  lastError: string | null
  clearError: () => void
}

const MasterAuthContext = createContext<MasterAuthState | null>(null)

export function MasterAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => subscribeAuth((next) => {
    setUser(next)
    setReady(true)
  }), [])

  const login = useCallback(async (password: string) => {
    setLastError(null)
    try {
      await loginMaster(password)
    } catch (error) {
      const message = explainAuthError(error)
      setLastError(message)
      throw new Error(message)
    }
  }, [])

  const logout = useCallback(async () => {
    setLastError(null)
    await logoutMaster()
  }, [])

  const value = useMemo<MasterAuthState>(
    () => ({
      ready,
      user,
      isAuthenticated: !!user,
      login,
      logout,
      lastError,
      clearError: () => setLastError(null),
    }),
    [ready, user, login, logout, lastError],
  )

  return <MasterAuthContext.Provider value={value}>{children}</MasterAuthContext.Provider>
}

export function useMasterAuth(): MasterAuthState {
  const ctx = useContext(MasterAuthContext)
  if (!ctx) throw new Error('useMasterAuth deve ser usado dentro de MasterAuthProvider.')
  return ctx
}

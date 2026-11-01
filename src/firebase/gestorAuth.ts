import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { get, ref } from 'firebase/database'
import { isStrongEnoughPassword, verifyPassword } from '../lib/crypto'
import { assertLojaSigla } from '../lib/sigla'
import { auth, database } from './config'
import { lojaEmail, storeMetaPath } from './paths'
import type { StoreMeta } from './types'

const SESSION_KEY = 'regional-gestor-session'

export type GestorSession = {
  sigla: string
  authEmail: string
}

export function readGestorSession(): GestorSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GestorSession
    if (!parsed?.sigla || !parsed?.authEmail) return null
    return parsed
  } catch {
    return null
  }
}

function writeGestorSession(session: GestorSession | null): void {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY)
    return
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function loginGestor(siglaInput: string, password: string): Promise<GestorSession> {
  const sigla = assertLojaSigla(siglaInput)
  const strength = isStrongEnoughPassword(password)
  if (strength) throw new Error(strength)

  const email = lojaEmail(sigla)

  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (code === 'auth/operation-not-allowed') {
      throw new Error('Ative E-mail/senha no Firebase Authentication.')
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password'
    ) {
      throw new Error(
        'Sigla ou senha inválida. Confirme se a loja foi criada no painel e se a conta Auth foi provisionada.',
      )
    }
    throw error
  }

  const snap = await get(ref(database, storeMetaPath(sigla)))
  if (!snap.exists()) {
    await signOut(auth)
    writeGestorSession(null)
    throw new Error(`Loja ${sigla} não encontrada na nuvem.`)
  }

  const meta = snap.val() as StoreMeta
  if (meta.active === false) {
    await signOut(auth)
    writeGestorSession(null)
    throw new Error(`Loja ${sigla} está inativa.`)
  }

  const hashOk = await verifyPassword(password, meta.passwordHash)
  if (!hashOk) {
    await signOut(auth)
    writeGestorSession(null)
    throw new Error('Senha inválida.')
  }

  const session: GestorSession = {
    sigla,
    authEmail: meta.authEmail ?? email,
  }
  writeGestorSession(session)
  return session
}

export async function logoutGestor(): Promise<void> {
  writeGestorSession(null)
  await signOut(auth)
}

export function subscribeGestorAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export function explainGestorAuthError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Falha ao entrar como gestor.'
}

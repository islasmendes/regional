import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { get, ref, set } from 'firebase/database'
import { hashPassword, isStrongEnoughPassword, verifyPassword } from '../lib/crypto'
import { auth, database } from './config'
import { masterConfigPath, masterEmail } from './paths'
import type { MasterConfig } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

export async function readMasterConfig(): Promise<MasterConfig | null> {
  const snap = await get(ref(database, masterConfigPath()))
  if (!snap.exists()) return null
  const value = snap.val() as Partial<MasterConfig>
  if (!value?.passwordHash) return null
  return {
    passwordHash: value.passwordHash,
    createdAt: value.createdAt ?? nowIso(),
    updatedAt: value.updatedAt ?? nowIso(),
  }
}

async function ensureMasterAuthSession(password: string): Promise<User> {
  const email = masterEmail()
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password'
    ) {
      try {
        const created = await createUserWithEmailAndPassword(auth, email, password)
        return created.user
      } catch (createError) {
        const createCode =
          typeof createError === 'object' && createError && 'code' in createError
            ? String(createError.code)
            : ''
        // Conta já existe → a senha informada está errada.
        if (createCode === 'auth/email-already-in-use') {
          throw Object.assign(new Error('Senha mestra incorreta.'), {
            code: 'auth/invalid-credential',
          })
        }
        throw createError
      }
    }
    throw error
  }
}

/**
 * Login unificado:
 * - autentica no Firebase Auth (cria a conta mestra no 1º acesso)
 * - se ainda não houver hash no RTDB, grava (bootstrap)
 * - se houver hash, valida a senha
 */
export async function loginMaster(password: string): Promise<void> {
  const strength = isStrongEnoughPassword(password)
  if (strength) throw new Error(strength)

  await ensureMasterAuthSession(password)

  const config = await readMasterConfig()
  if (!config) {
    const passwordHash = await hashPassword(password)
    const payload: MasterConfig = {
      passwordHash,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await set(ref(database, masterConfigPath()), payload)
    return
  }

  const ok = await verifyPassword(password, config.passwordHash)
  if (!ok) {
    await signOut(auth)
    throw new Error('Senha mestra incorreta.')
  }
}

export async function logoutMaster(): Promise<void> {
  await signOut(auth)
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export function explainAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'auth/operation-not-allowed') {
    return 'Ative E-mail/senha no Firebase Console → Authentication → Sign-in method.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Sem rede para autenticar na nuvem. Verifique a conexão.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Aguarde um momento e tente de novo.'
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Senha mestra incorreta.'
  }
  if (code === 'auth/weak-password') {
    return 'Senha fraca demais. Use no mínimo 6 caracteres.'
  }
  if (
    code === 'PERMISSION_DENIED' ||
    (error instanceof Error && /permission_denied|permission/i.test(error.message))
  ) {
    return 'RTDB negou acesso. Publique as regras em firebase/database.rules.json com o Firebase CLI.'
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Falha na autenticação na nuvem.'
}

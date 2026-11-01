import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { getSecondaryAuth } from './config'
import { lojaEmail } from './paths'

/**
 * Garante conta Auth `loja.{sigla}@…` com a senha informada.
 * Usa app Firebase secundário para não deslogar o master.
 */
export async function provisionStoreAuth(sigla: string, password: string): Promise<string> {
  const email = lojaEmail(sigla)
  const secondary = getSecondaryAuth()

  try {
    await createUserWithEmailAndPassword(secondary, email, password)
    await signOut(secondary)
    return email
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

    if (code === 'auth/email-already-in-use') {
      // Conta já existe: tenta autenticar com a nova senha (já sincronizada)
      // ou com fluxo de atualização se a senha antiga ainda funcionar — aqui
      // só a nova é conhecida no reset. Tentamos login com a nova; se falhar,
      // removemos a sessão e orientamos recriação.
      try {
        const cred = await signInWithEmailAndPassword(secondary, email, password)
        await updatePassword(cred.user, password)
        await signOut(secondary)
        return email
      } catch {
        await signOut(secondary).catch(() => undefined)
        throw new Error(
          `A conta Auth ${email} já existe com outra senha. No Firebase Console → Authentication, exclua esse usuário e clique em “Redefinir senha” de novo — ou exclua/recrie a loja.`,
        )
      }
    }

    if (code === 'auth/operation-not-allowed') {
      throw new Error('Ative E-mail/senha no Firebase Authentication (Sign-in method).')
    }

    throw error
  }
}

/** Melhor esforço: remove a conta Auth da loja (precisa da senha atual). */
export async function tryDeleteStoreAuth(sigla: string, password: string): Promise<void> {
  const email = lojaEmail(sigla)
  const secondary = getSecondaryAuth()
  try {
    const cred = await signInWithEmailAndPassword(secondary, email, password)
    await deleteUser(cred.user)
  } catch {
    await signOut(secondary).catch(() => undefined)
  }
}

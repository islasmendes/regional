import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

/**
 * Projeto Firebase dedicado do Regional (não misturar com gestao-altaperformance).
 * databaseURL é obrigatório para o Realtime Database no client.
 *
 * Anônimo pode estar ligado no Console (projeto “privado”), mas o painel e o
 * gestor usam E-mail/senha sintético. Anônimo sozinho não libera dados no RTDB.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBMzmPGNAWYISvW0URV3D0fs891hKpHroQ',
  authDomain: 'regionalaltaperformance.firebaseapp.com',
  databaseURL: 'https://regionalaltaperformance-default-rtdb.firebaseio.com',
  projectId: 'regionalaltaperformance',
  storageBucket: 'regionalaltaperformance.firebasestorage.app',
  messagingSenderId: '1021837087655',
  appId: '1:1021837087655:web:35b1ccf8eb6086f75cdc82',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const database = getDatabase(firebaseApp)

let secondaryApp: FirebaseApp | null = null
let secondaryAuth: Auth | null = null

/** Instância paralela para criar/atualizar contas de loja sem derrubar a sessão mestra. */
export function getSecondaryAuth(): Auth {
  if (secondaryAuth) return secondaryAuth
  secondaryApp = initializeApp(firebaseConfig, 'regional-secondary')
  secondaryAuth = getAuth(secondaryApp)
  return secondaryAuth
}

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

/**
 * Projeto Firebase dedicado do Regional (não misturar com gestao-altaperformance).
 * databaseURL é obrigatório para o Realtime Database no client.
 */
const firebaseConfig = {
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

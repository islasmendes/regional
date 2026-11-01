const ITERATIONS = 120_000
const HASH_BYTES = 32

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return salt
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      // BufferSource tipado de forma estrita em alguns DOM libs; Uint8Array é válido em runtime.
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    HASH_BYTES * 8,
  )
}

/** Formato: pbkdf2$iterations$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomSalt()
  const bits = await deriveKey(password, salt)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(bits)}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algo, iterRaw, saltB64, hashB64] = encoded.split('$')
  if (algo !== 'pbkdf2' || !iterRaw || !saltB64 || !hashB64) return false
  const iterations = Number(iterRaw)
  if (!Number.isFinite(iterations) || iterations < 10_000) return false
  const salt = fromBase64(saltB64)
  const expected = fromBase64(hashB64)
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    material,
    expected.length * 8,
  )
  const actual = new Uint8Array(bits)
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}

export function isStrongEnoughPassword(password: string): string | null {
  if (password.length < 6) return 'Use no mínimo 6 caracteres (exigência do Firebase Auth).'
  return null
}

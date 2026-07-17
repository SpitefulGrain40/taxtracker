export interface EncryptedBlob {
  algorithm: 'AES-GCM'
  salt: string       // base64
  iv: string         // base64
  ciphertext: string // base64
}

const ITERATIONS = 100_000

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptJSON(data: unknown, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    algorithm: 'AES-GCM',
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(ct)),
  }
}

export async function decryptJSON<T = unknown>(blob: EncryptedBlob, password: string): Promise<T> {
  const salt = unb64(blob.salt)
  const iv = unb64(blob.iv)
  const key = await deriveKey(password, salt)
  const ct = unb64(blob.ciphertext)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return JSON.parse(new TextDecoder().decode(pt)) as T
}

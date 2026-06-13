const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const IV_BYTES = 12

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return toBase64(salt)
}

export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(fromBase64(saltBase64)),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportRoomKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return toBase64(raw)
}

export async function importRoomKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(fromBase64(base64)),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encoder = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )
  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv),
  }
}

export async function decryptWithKey(
  ciphertext: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(fromBase64(iv)) },
    key,
    new Uint8Array(fromBase64(ciphertext)),
  )
  return new TextDecoder().decode(decrypted)
}

export async function wrapKeyForUser(
  secret: string,
  password: string,
  saltBase64: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(password, saltBase64)
  return encryptWithKey(secret, key)
}

export async function unwrapKeyForUser(
  ciphertext: string,
  iv: string,
  password: string,
  saltBase64: string,
): Promise<string> {
  const key = await deriveKey(password, saltBase64)
  return decryptWithKey(ciphertext, iv, key)
}

export async function encryptRoomKeyForUser(
  roomKey: CryptoKey,
  password: string,
  saltBase64: string,
): Promise<{ ciphertext: string; iv: string }> {
  const raw = await exportRoomKey(roomKey)
  return wrapKeyForUser(raw, password, saltBase64)
}

export async function decryptRoomKeyForUser(
  ciphertext: string,
  iv: string,
  password: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const raw = await unwrapKeyForUser(ciphertext, iv, password, saltBase64)
  return importRoomKey(raw)
}

export async function deriveDmKey(roomKey: CryptoKey, threadId: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.exportKey('raw', roomKey)
  const baseKey = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('friends-chat-dm'),
      info: new TextEncoder().encode(threadId),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

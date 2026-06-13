import { decryptWithKey, encryptWithKey } from './keys'

export async function encryptMessage(
  text: string,
  roomKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  return encryptWithKey(text, roomKey)
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  roomKey: CryptoKey,
): Promise<string> {
  return decryptWithKey(ciphertext, iv, roomKey)
}

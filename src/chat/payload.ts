import { decryptMessage, encryptMessage } from '../crypto/messages'

export const MAX_FILE_BYTES = 512 * 1024

export type TextPayload = { type: 'text'; text: string }
export type FilePayload = { type: 'file'; name: string; mime: string; data: string }
export type MessagePayload = TextPayload | FilePayload

export async function encryptPayload(
  payload: MessagePayload,
  roomKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  return encryptMessage(JSON.stringify(payload), roomKey)
}

export async function decryptPayload(
  ciphertext: string,
  iv: string,
  roomKey: CryptoKey,
): Promise<MessagePayload> {
  const raw = await decryptMessage(ciphertext, iv, roomKey)
  try {
    const parsed = JSON.parse(raw) as MessagePayload
    if (parsed.type === 'text' && typeof parsed.text === 'string') {
      return parsed
    }
    if (
      parsed.type === 'file' &&
      typeof parsed.name === 'string' &&
      typeof parsed.mime === 'string' &&
      typeof parsed.data === 'string'
    ) {
      return parsed
    }
  } catch {
    // Legacy messages stored as plain text
  }
  return { type: 'text', text: raw }
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function downloadFile(name: string, mime: string, base64: string): void {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

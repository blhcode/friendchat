import { deriveDmKey } from '../crypto/keys'
import {
  decryptPayload,
  encryptPayload,
  fileToBase64,
  MAX_FILE_BYTES,
} from './payload'
import { makeThreadId } from './thread'
import { writeFileWithRetry } from '../storage'
import { startMessagePolling } from '../github/poll'
import type { MessagesFile, Session, StoredMessage } from '../types'

export interface ChatMessage {
  id: string
  sender: string
  timestamp: number
  type: 'text' | 'file'
  text?: string
  file?: {
    name: string
    mime: string
    data: string
    size: number
  }
}

export interface ChatController {
  stop: () => void
  send: (text: string) => Promise<void>
  sendFile: (file: File) => Promise<void>
}

export function createChatController(
  session: Session,
  recipient: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (message: string) => void,
): ChatController {
  const threadId = makeThreadId(session.username, recipient)
  let dmKeyPromise: Promise<CryptoKey> | null = null

  const getDmKey = () => {
    if (!dmKeyPromise) {
      dmKeyPromise = deriveDmKey(session.roomKey, threadId)
    }
    return dmKeyPromise
  }

  const handleUpdate = async (data: MessagesFile) => {
    try {
      const threadMessages = data.messages.filter(
        (m) => m.threadId === threadId || (!m.threadId && isLegacyThreadMessage(m, session.username, recipient)),
      )

      const dmKey = await getDmKey()
      const decrypted = await Promise.all(
        threadMessages.map((m) => decryptStoredMessage(m, dmKey, session.roomKey)),
      )
      decrypted.sort((a, b) => a.timestamp - b.timestamp)
      onMessages(decrypted)
    } catch {
      onError('Failed to decrypt messages.')
    }
  }

  const stop = startMessagePolling(session.apiToken, (data) => {
    void handleUpdate(data)
  })

  const appendMessage = async (payload: Parameters<typeof encryptPayload>[0]) => {
    const dmKey = await getDmKey()
    const encrypted = await encryptPayload(payload, dmKey)
    const newMessage: StoredMessage = {
      id: crypto.randomUUID(),
      sender: session.username,
      threadId,
      timestamp: Date.now(),
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
    }

    await writeFileWithRetry<MessagesFile>(
      'data/messages.json',
      session.apiToken,
      (current) => ({
        messages: [...(current?.messages ?? []), newMessage],
      }),
      `DM from ${session.username} to ${recipient}`,
    )
  }

  return {
    stop,
    send: async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      await appendMessage({ type: 'text', text: trimmed })
    },
    sendFile: async (file: File) => {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`File must be under ${MAX_FILE_BYTES / 1024} KB.`)
      }
      const data = await fileToBase64(file)
      await appendMessage({
        type: 'file',
        name: file.name,
        mime: file.type || 'application/octet-stream',
        data,
      })
    },
  }
}

function isLegacyThreadMessage(
  message: StoredMessage,
  self: string,
  recipient: string,
): boolean {
  if (message.threadId) return false
  const selfLower = self.toLowerCase()
  const recipientLower = recipient.toLowerCase()
  const senderLower = message.sender.toLowerCase()
  return senderLower === selfLower || senderLower === recipientLower
}

async function decryptStoredMessage(
  message: StoredMessage,
  dmKey: CryptoKey,
  roomKey: CryptoKey,
): Promise<ChatMessage> {
  const key = message.threadId ? dmKey : roomKey
  const payload = await decryptPayload(message.ciphertext, message.iv, key)

  if (payload.type === 'file') {
    const size = atob(payload.data).length
    return {
      id: message.id,
      sender: message.sender,
      timestamp: message.timestamp,
      type: 'file',
      file: {
        name: payload.name,
        mime: payload.mime,
        data: payload.data,
        size,
      },
    }
  }

  return {
    id: message.id,
    sender: message.sender,
    timestamp: message.timestamp,
    type: 'text',
    text: payload.text,
  }
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

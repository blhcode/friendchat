import { readMessagesFile } from '../storage'
import type { MessagesFile } from '../types'

export type MessagePollCallback = (data: MessagesFile, sha: string) => void

export function startMessagePolling(
  token: string,
  onUpdate: MessagePollCallback,
  intervalMs = 3000,
): () => void {
  let lastSha = ''
  let active = true

  const poll = async () => {
    if (!active) return
    try {
      const result = await readMessagesFile(token)
      if (result && result.sha !== lastSha) {
        lastSha = result.sha
        onUpdate(result.data, result.sha)
      }
    } catch {
      // Polling errors are non-fatal; next tick will retry
    }
  }

  void poll()
  const id = window.setInterval(() => void poll(), intervalMs)

  return () => {
    active = false
    window.clearInterval(id)
  }
}

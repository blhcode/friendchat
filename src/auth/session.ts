import type { RepoConfig, Session } from '../types'

const SESSION_KEY = 'chat_session'
const REPO_KEY = 'chat_repo'
const READ_TOKEN_KEY = 'chat_read_token'

export function getRepoConfig(): RepoConfig | null {
  const raw = localStorage.getItem(REPO_KEY)
  if (!raw) return null
  return JSON.parse(raw) as RepoConfig
}

export function setRepoConfig(config: RepoConfig): void {
  localStorage.setItem(REPO_KEY, JSON.stringify(config))
}

export function getReadToken(): string | null {
  return localStorage.getItem(READ_TOKEN_KEY)
}

export function setReadToken(token: string): void {
  localStorage.setItem(READ_TOKEN_KEY, token)
}

export async function restoreSession(): Promise<Session | null> {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null

  const parsed = JSON.parse(raw) as {
    username: string
    role: Session['role']
    apiToken: string
    roomKeyJwk: JsonWebKey
  }

  const roomKey = await crypto.subtle.importKey(
    'jwk',
    parsed.roomKeyJwk,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )

  return {
    username: parsed.username,
    role: parsed.role,
    apiToken: parsed.apiToken,
    roomKey,
  }
}

export async function saveSession(session: Session): Promise<void> {
  const roomKeyJwk = await crypto.subtle.exportKey('jwk', session.roomKey)
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: session.username,
      role: session.role,
      apiToken: session.apiToken,
      roomKeyJwk,
    }),
  )
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function captureBootstrapTokenFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('bootstrap')
  if (!token) return

  setReadToken(token)
  params.delete('bootstrap')
  const newUrl =
    window.location.pathname +
    (params.toString() ? `?${params.toString()}` : '') +
    window.location.hash
  window.history.replaceState({}, '', newUrl)
}

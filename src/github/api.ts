import type { MessagesFile, RepoConfig, UsersFile } from '../types'

const API_BASE = 'https://api.github.com'

export class GitHubApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface FileContent {
  content: string
  sha: string
}

function requestHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function decodeContent(base64: string): string {
  return decodeURIComponent(
    atob(base64.replace(/\n/g, ''))
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  )
}

function encodeContent(content: string): string {
  return btoa(unescape(encodeURIComponent(content)))
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    return body.message ?? response.statusText
  } catch {
    return response.statusText
  }
}

export async function testRepoAccess(
  config: RepoConfig,
  token: string,
): Promise<void> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}`
  const response = await fetch(url, { headers: requestHeaders(token) })
  if (!response.ok) {
    throw new GitHubApiError(await parseError(response), response.status)
  }
}

export async function readFile<T>(
  config: RepoConfig,
  token: string | undefined,
  path: string,
): Promise<{ data: T; sha: string } | null> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`
  const response = await fetch(url, { headers: requestHeaders(token) })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new GitHubApiError(await parseError(response), response.status)
  }

  const body = (await response.json()) as FileContent
  const decoded = decodeContent(body.content)
  return { data: JSON.parse(decoded) as T, sha: body.sha }
}

export async function writeFile<T>(
  config: RepoConfig,
  token: string,
  path: string,
  data: T,
  sha: string | null,
  message: string,
): Promise<string> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`
  const body: Record<string, string> = {
    message,
    content: encodeContent(JSON.stringify(data, null, 2)),
  }
  if (sha) {
    body.sha = sha
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...requestHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new GitHubApiError(await parseError(response), response.status)
  }

  const result = (await response.json()) as { content: { sha: string } }
  return result.content.sha
}

export async function writeFileWithRetry<T>(
  config: RepoConfig,
  token: string,
  path: string,
  updater: (current: T | null) => T,
  message: string,
  maxRetries = 3,
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const existing = await readFile<T>(config, token, path)
      const updated = updater(existing?.data ?? null)
      return await writeFile(config, token, path, updated, existing?.sha ?? null, message)
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 409 && attempt < maxRetries - 1) {
        lastError = error
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('Failed to write file after retries')
}

export async function readUsersFile(
  config: RepoConfig,
  token?: string,
): Promise<{ data: UsersFile; sha: string } | null> {
  return readFile<UsersFile>(config, token, 'data/users.json')
}

export async function readMessagesFile(
  config: RepoConfig,
  token?: string,
): Promise<{ data: MessagesFile; sha: string } | null> {
  return readFile<MessagesFile>(config, token, 'data/messages.json')
}

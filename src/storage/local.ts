import type { MessagesFile, UsersFile } from '../types'

export class StorageError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function readFile<T>(fileName: string): Promise<{ data: T; sha: string } | null> {
  const response = await fetch(`/api/data/${fileName}`)
  if (response.status === 404) return null
  if (!response.ok) {
    const body = (await response.json()) as { error?: string }
    throw new StorageError(body.error ?? 'Read failed', response.status)
  }
  return (await response.json()) as { data: T; sha: string }
}

async function writeFile<T>(
  fileName: string,
  data: T,
  sha: string | null,
): Promise<string> {
  const response = await fetch(`/api/data/${fileName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, sha }),
  })

  if (!response.ok) {
    const body = (await response.json()) as { error?: string }
    throw new StorageError(body.error ?? 'Write failed', response.status)
  }

  const result = (await response.json()) as { sha: string }
  return result.sha
}

export async function writeFileWithRetry<T>(
  fileName: string,
  updater: (current: T | null) => T,
  maxRetries = 3,
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const existing = await readFile<T>(fileName)
      const updated = updater(existing?.data ?? null)
      return await writeFile(fileName, updated, existing?.sha ?? null)
    } catch (error) {
      if (error instanceof StorageError && error.status === 409 && attempt < maxRetries - 1) {
        lastError = error
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('Failed to write file after retries')
}

export async function readUsersFile(): Promise<{ data: UsersFile; sha: string } | null> {
  return readFile<UsersFile>('users.json')
}

export async function readMessagesFile(): Promise<{ data: MessagesFile; sha: string } | null> {
  return readFile<MessagesFile>('messages.json')
}

export async function writeUsersFile(data: UsersFile, sha: string | null): Promise<string> {
  return writeFile('users.json', data, sha)
}

export async function writeMessagesFile(data: MessagesFile, sha: string | null): Promise<string> {
  return writeFile('messages.json', data, sha)
}

export const LOCAL_API_TOKEN = 'local'

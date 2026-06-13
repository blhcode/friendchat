import { getAppConfig, isLocalMode } from '../config'
import { getRepoConfig, setReadToken, setRepoConfig } from '../auth/session'
import * as github from '../github/api'
import * as local from './local'
import type { MessagesFile, RepoConfig, UsersFile } from '../types'

export { StorageError } from './local'
export { GitHubApiError } from '../github/api'

export async function readUsersFile(
  token?: string,
): Promise<{ data: UsersFile; sha: string } | null> {
  if (isLocalMode()) return local.readUsersFile()
  const config = getRepoConfig()
  if (!config || !token) throw new Error('GitHub not configured.')
  return github.readUsersFile(config, token)
}

export async function readMessagesFile(
  token?: string,
): Promise<{ data: MessagesFile; sha: string } | null> {
  if (isLocalMode()) return local.readMessagesFile()
  const config = getRepoConfig()
  if (!config || !token) throw new Error('GitHub not configured.')
  return github.readMessagesFile(config, token)
}

export async function writeFileWithRetry<T>(
  path: string,
  token: string,
  updater: (current: T | null) => T,
  message: string,
  maxRetries = 3,
): Promise<string> {
  if (isLocalMode()) {
    const fileName = path.replace('data/', '')
    return local.writeFileWithRetry<T>(fileName, updater, maxRetries)
  }

  const config = getRepoConfig()
  if (!config) throw new Error('GitHub not configured.')
  return github.writeFileWithRetry(config, token, path, updater, message, maxRetries)
}

export async function writeInitialFiles(
  usersFile: UsersFile,
  messagesFile: MessagesFile,
  token: string,
): Promise<void> {
  if (isLocalMode()) {
    await local.writeUsersFile(usersFile, null)
    await local.writeMessagesFile(messagesFile, null)
    return
  }

  const config = getRepoConfig()
  if (!config) throw new Error('GitHub not configured.')
  await github.writeFile(config, token, 'data/users.json', usersFile, null, 'Initialize chat users')
  await github.writeFile(
    config,
    token,
    'data/messages.json',
    messagesFile,
    null,
    'Initialize chat messages',
  )
}

export async function isStorageSetupComplete(token?: string): Promise<boolean> {
  const users = await readUsersFile(token)
  return users !== null
}

export async function testStorageAccess(token?: string): Promise<void> {
  if (isLocalMode()) return
  const config = getRepoConfig()
  if (!config || !token) throw new Error('GitHub not configured.')
  await github.testRepoAccess(config, token)
}

export function getApiTokenForSetup(): string {
  if (isLocalMode()) return local.LOCAL_API_TOKEN
  const appConfig = getAppConfig()
  const pat = appConfig?.github?.pat?.trim()
  if (pat) return pat
  throw new Error('GitHub PAT missing from config.json')
}

export function applyGithubConfigFromFile(): void {
  const appConfig = getAppConfig()
  if (!appConfig?.github) return
  const { owner, repo, pat } = appConfig.github
  if (owner && repo) {
    setRepoConfig({ owner, repo })
  }
  if (pat) {
    setReadToken(pat)
  }
}

export function getStorageLabel(): string {
  return isLocalMode() ? 'Local' : 'GitHub'
}

export type { RepoConfig }

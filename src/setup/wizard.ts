import { setReadToken, setRepoConfig } from '../auth/session'
import {
  isStorageSetupComplete,
  testStorageAccess,
  writeInitialFiles,
} from '../storage'
import type { RepoConfig } from '../types'
import { buildInitialUsersFile } from './build-users'
import { readUsersFile } from '../storage'

export interface SetupInput {
  owner: string
  repo: string
  apiToken: string
  adminUsername: string
  adminPassword: string
}

export async function isSetupComplete(
  config: RepoConfig,
  token?: string,
): Promise<boolean> {
  void config
  return isStorageSetupComplete(token)
}

export async function runSetup(input: SetupInput): Promise<void> {
  const config: RepoConfig = { owner: input.owner.trim(), repo: input.repo.trim() }
  const token = input.apiToken.trim()

  setRepoConfig(config)
  setReadToken(token)

  await testStorageAccess(token)

  const existing = await readUsersFile(token)
  if (existing) {
    throw new Error('Setup already completed. Log in instead.')
  }

  const usersFile = await buildInitialUsersFile(
    input.adminUsername,
    input.adminPassword,
    token,
  )

  await writeInitialFiles(usersFile, { messages: [] }, token)
}

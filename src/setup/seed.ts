import type { AppConfig } from '../config'
import { isLocalMode } from '../config'
import {
  getApiTokenForSetup,
  isStorageSetupComplete,
  writeInitialFiles,
} from '../storage'
import { setReadToken, setRepoConfig } from '../auth/session'
import { buildInitialUsersFile } from './build-users'

export async function seedFromConfig(appConfig: AppConfig): Promise<void> {
  if (appConfig.mode === 'github' && appConfig.github) {
    const { owner, repo, pat } = appConfig.github
    if (owner && repo) {
      setRepoConfig({ owner: owner.trim(), repo: repo.trim() })
    }
    if (pat?.trim()) {
      setReadToken(pat.trim())
    }
  }

  const token = isLocalMode() ? undefined : getApiTokenForSetup()
  const readToken = isLocalMode() ? undefined : token

  if (await isStorageSetupComplete(readToken)) {
    return
  }

  const apiToken = getApiTokenForSetup()
  const usersFile = await buildInitialUsersFile(
    appConfig.admin.username,
    appConfig.admin.password,
    apiToken,
  )

  await writeInitialFiles(usersFile, { messages: [] }, apiToken)
}

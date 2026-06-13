export interface AppConfig {
  mode: 'local' | 'github'
  admin: {
    username: string
    password: string
  }
  github?: {
    owner: string
    repo: string
    pat?: string
  }
}

const GITHUB_DEFAULT: AppConfig = {
  mode: 'github',
  admin: { username: '', password: '' },
}

let cached: AppConfig | null = null

export async function loadAppConfig(): Promise<AppConfig> {
  if (cached) return cached

  try {
    const response = await fetch('/config.json')
    if (!response.ok) {
      cached = GITHUB_DEFAULT
      return cached
    }
    cached = (await response.json()) as AppConfig
    return cached
  } catch {
    cached = GITHUB_DEFAULT
    return cached
  }
}

export function getAppConfig(): AppConfig | null {
  return cached
}

export function isLocalMode(): boolean {
  return cached?.mode === 'local'
}

export function hasConfigFile(): boolean {
  return cached !== null && cached !== GITHUB_DEFAULT
}

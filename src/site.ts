export interface SiteConfig {
  owner: string
  repo: string
}

let cached: SiteConfig | null = null

/** Detect owner/repo from https://username.github.io/repo-name/ */
export function detectGithubPagesConfig(): SiteConfig | null {
  const host = window.location.hostname
  if (!host.endsWith('.github.io')) return null

  const owner = host.slice(0, -'.github.io'.length)
  if (!owner || owner.includes('.')) return null

  const segment = window.location.pathname.split('/').filter(Boolean)[0]
  if (!segment || segment.endsWith('.html')) return null

  return { owner, repo: segment }
}

export async function loadSiteConfig(): Promise<SiteConfig | null> {
  if (cached) return cached

  const detected = detectGithubPagesConfig()
  if (detected) {
    cached = detected
    return cached
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}site.json`)
    if (!response.ok) return null
    const data = (await response.json()) as SiteConfig
    if (data.owner && data.repo && !data.owner.includes('YOUR_GITHUB')) {
      cached = data
      return cached
    }
    return null
  } catch {
    return null
  }
}

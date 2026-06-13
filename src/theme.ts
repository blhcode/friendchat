export type Theme = 'light' | 'dark'

const THEME_KEY = 'chat_theme'

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.dataset.theme = theme
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

export function initTheme(): void {
  document.documentElement.dataset.theme = getTheme()
}

export function themeToggleLabel(theme: Theme): string {
  return theme === 'dark' ? 'Light mode' : 'Dark mode'
}

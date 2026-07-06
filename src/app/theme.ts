import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'runalyze:theme'

/** Read the persisted theme, defaulting to dark. */
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to default
  }
  return 'dark'
}

/** Reflect the theme onto <html>. Dark is the default (no attribute). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
}

function persist(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // best-effort; ignore quota/availability errors
  }
}

interface ThemeState {
  theme: Theme
  setTheme(theme: Theme): void
  toggle(): void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    persist(theme)
    applyTheme(theme)
    set({ theme })
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

import type { ReactNode } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { BRAND, TAGLINE } from './app/brand'
import { useContainer } from './app/container-context'
import { ActivityScreen } from './app/screens/activity/activity-screen'
import { LibraryScreen } from './app/screens/library/library-screen'
import { TrendsScreen } from './app/screens/trends/trends-screen'
import { useThemeStore } from './app/theme'

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 text-xs font-medium text-fg-2 transition-colors hover:bg-sunk"
    >
      <span
        className="h-3 w-3 rounded-full border-2 border-current"
        style={{ background: theme === 'light' ? 'currentColor' : 'transparent' }}
      />
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-fg-2 transition-colors hover:bg-sunk hover:text-fg"
    >
      {children}
    </Link>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header
        role="banner"
        className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel px-6"
      >
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-accent">
            <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-white" />
          </span>
          <span className="text-sm font-bold tracking-tight text-fg">{BRAND}</span>
          <span className="font-mono text-[10.5px] text-fg-3">{TAGLINE}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <NavLink to="/">Library</NavLink>
          <NavLink to="/trends">Trends</NavLink>
        </nav>
        <ThemeToggle />
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  )
}

export function App() {
  const { persistent } = useContainer()
  const theme = useThemeStore((s) => s.theme)
  return (
    <AppShell>
      {!persistent && (
        <p className="mb-6 rounded-lg border border-caution/40 bg-caution/10 px-3 py-2 text-sm text-caution">
          Storage is unavailable — this session won't be saved. Runs disappear when you close the
          tab.
        </p>
      )}
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/activity/:id" element={<ActivityScreen />} />
        <Route path="/trends" element={<TrendsScreen />} />
      </Routes>
      <Toaster theme={theme} position="bottom-right" />
    </AppShell>
  )
}

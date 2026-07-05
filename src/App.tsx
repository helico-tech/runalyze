import type { ReactNode } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { BRAND, TAGLINE } from './app/brand'
import { useContainer } from './app/container-context'
import { ActivityScreen } from './app/screens/activity/activity-screen'
import { LibraryScreen } from './app/screens/library/library-screen'
import { TrendsScreen } from './app/screens/trends/trends-screen'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header role="banner" className="flex items-baseline gap-3 border-b border-line px-6 py-3">
        <Link to="/" className="font-mono text-sm font-semibold uppercase tracking-[0.25em]">
          {BRAND}
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          {TAGLINE}
        </span>
        <nav className="ml-auto flex gap-4 font-mono text-xs uppercase tracking-widest text-ink-muted">
          <Link to="/" className="hover:text-ink">
            Library
          </Link>
          <Link to="/trends" className="hover:text-ink">
            Trends
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

export function App() {
  const { persistent } = useContainer()
  return (
    <AppShell>
      {!persistent && (
        <p className="mb-6 rounded-md border border-caution/40 bg-caution/10 px-3 py-2 text-sm text-caution">
          Storage is unavailable — this session won't be saved. Runs disappear when you close the
          tab.
        </p>
      )}
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/activity/:id" element={<ActivityScreen />} />
        <Route path="/trends" element={<TrendsScreen />} />
      </Routes>
      <Toaster theme="dark" position="bottom-right" />
    </AppShell>
  )
}

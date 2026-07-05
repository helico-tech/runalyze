import type { ReactNode } from 'react'
import { BRAND, TAGLINE } from './app/brand'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header role="banner" className="flex items-baseline gap-3 border-b border-line px-6 py-3">
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.25em]">{BRAND}</span>
        <span className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          {TAGLINE}
        </span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

export function App() {
  return (
    <AppShell>
      <p className="text-ink-muted">No runs yet. Drop a FIT file to begin.</p>
    </AppShell>
  )
}

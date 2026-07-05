export function formatDuration(s: number): string {
  const total = Math.round(s)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

export function formatPace(mPerS: number): string {
  if (!Number.isFinite(mPerS) || mPerS <= 0) return '–'
  const sPerKm = Math.round(1000 / mPerS)
  const m = Math.floor(sPerKm / 60)
  const s = sPerKm % 60
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function formatDistanceKm(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '–'
  return `${(m / 1000).toFixed(2)} km`
}

export function formatBpm(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '–'
  return `${Math.round(v)} bpm`
}

/** Local calendar date — a run at 00:30 local must not show yesterday's date. */
export function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

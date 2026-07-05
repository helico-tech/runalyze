import type { Activity, Lap } from './types'

/** Button-press laps only (excludes auto and session-end laps). */
export function manualLaps(a: Activity): Lap[] {
  return (a.laps ?? []).filter((l) => l.trigger === 'manual')
}

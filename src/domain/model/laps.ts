import type { Activity, Lap } from './types'

/** Manual + auto laps (excludes the trailing session-end fragment), in order. */
export function displayLaps(a: Activity): Lap[] {
  return (a.laps ?? []).filter((l) => l.trigger !== 'session-end')
}

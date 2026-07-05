import type { Exclusions, Sector, TimeRange } from '../../../domain/model/types'

export function pxToleranceS(pxTol: number, domainS: number, plotWidthPx: number): number {
  if (plotWidthPx <= 0) return Infinity
  return (pxTol / plotWidthPx) * domainS
}

export type DragTarget =
  | { kind: 'create' }
  | { kind: 'move-sector'; id: string }
  | { kind: 'resize-start'; id: string }
  | { kind: 'resize-end'; id: string }
  | { kind: 'trim-warmup' }
  | { kind: 'trim-cooldown' }

interface EdgeCandidate {
  timeS: number
  target: DragTarget
}

export function hitTest(timeS: number, sectors: Sector[], ex: Exclusions, tolS: number): DragTarget {
  const edges: EdgeCandidate[] = [
    { timeS: ex.warmupEndS, target: { kind: 'trim-warmup' } },
    { timeS: ex.cooldownStartS, target: { kind: 'trim-cooldown' } },
  ]
  for (const s of sectors) {
    edges.push({ timeS: s.range.startS, target: { kind: 'resize-start', id: s.id } })
    edges.push({ timeS: s.range.endS, target: { kind: 'resize-end', id: s.id } })
  }
  let best: EdgeCandidate | null = null
  let bestDist = Infinity
  for (const e of edges) {
    const d = Math.abs(e.timeS - timeS)
    if (d <= tolS && d < bestDist) {
      bestDist = d
      best = e
    }
  }
  if (best) return best.target
  for (const s of sectors) {
    if (timeS >= s.range.startS && timeS < s.range.endS) {
      return { kind: 'move-sector', id: s.id }
    }
  }
  return { kind: 'create' }
}

export interface DragResult {
  sectors: Sector[]
  exclusions: Exclusions
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function applyDrag(
  target: DragTarget,
  sectors: Sector[],
  ex: Exclusions,
  grabTimeS: number,
  currentTimeS: number,
  durationS: number,
  minWidthS: number,
): DragResult {
  if (target.kind === 'trim-warmup') {
    return {
      sectors,
      exclusions: {
        warmupEndS: clamp(currentTimeS, 0, ex.cooldownStartS - minWidthS),
        cooldownStartS: ex.cooldownStartS,
      },
    }
  }
  if (target.kind === 'trim-cooldown') {
    return {
      sectors,
      exclusions: {
        warmupEndS: ex.warmupEndS,
        cooldownStartS: clamp(currentTimeS, ex.warmupEndS + minWidthS, durationS),
      },
    }
  }
  if (target.kind === 'create') return { sectors, exclusions: ex }
  const id = target.id
  const mapRange = (s: Sector): TimeRange => {
    const { startS, endS } = s.range
    if (target.kind === 'resize-start') {
      return { startS: clamp(currentTimeS, 0, endS - minWidthS), endS }
    }
    if (target.kind === 'resize-end') {
      return { startS, endS: clamp(currentTimeS, startS + minWidthS, durationS) }
    }
    // move-sector: shift preserving width, clamped into bounds
    const width = endS - startS
    const delta = currentTimeS - grabTimeS
    const newStart = clamp(startS + delta, 0, durationS - width)
    return { startS: newStart, endS: newStart + width }
  }
  return {
    sectors: sectors.map((s) => (s.id === id ? { ...s, range: mapRange(s) } : s)),
    exclusions: ex,
  }
}

export function createSector(
  id: string,
  aS: number,
  bS: number,
  durationS: number,
  minWidthS: number,
): Sector | null {
  const startS = clamp(Math.min(aS, bS), 0, durationS)
  const endS = clamp(Math.max(aS, bS), 0, durationS)
  if (endS - startS < minWidthS) return null
  return { id, activityId: '', range: { startS, endS }, label: '', kind: 'sector' }
}

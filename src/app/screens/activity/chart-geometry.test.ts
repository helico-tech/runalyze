import { describe, expect, it } from 'vitest'
import type { Exclusions, Sector } from '../../../domain/model/types'
import { applyDrag, createSector, hitTest, pxToleranceS } from './chart-geometry'

const ex: Exclusions = { warmupEndS: 300, cooldownStartS: 3300 }
const sectors: Sector[] = [
  { id: 's1', activityId: 'a', range: { startS: 600, endS: 1200 }, label: '', kind: 'sector' },
  { id: 's2', activityId: 'a', range: { startS: 1800, endS: 2400 }, label: '', kind: 'sector' },
]

describe('pxToleranceS', () => {
  it('converts a pixel tolerance to time units', () => {
    // 6px tolerance over a 3600s domain shown across 900px → 24s
    expect(pxToleranceS(6, 3600, 900)).toBe(24)
  })
  it('is zero-safe on zero width', () => {
    expect(pxToleranceS(6, 3600, 0)).toBe(Infinity)
  })
})

describe('hitTest', () => {
  const tol = 20
  it('grabs the nearest sector edge within tolerance', () => {
    expect(hitTest(610, sectors, ex, tol)).toEqual({ kind: 'resize-start', id: 's1' })
    expect(hitTest(1195, sectors, ex, tol)).toEqual({ kind: 'resize-end', id: 's1' })
  })
  it('grabs trim handles', () => {
    expect(hitTest(305, sectors, ex, tol)).toEqual({ kind: 'trim-warmup' })
    expect(hitTest(3290, sectors, ex, tol)).toEqual({ kind: 'trim-cooldown' })
  })
  it('moves when inside a sector body away from edges', () => {
    expect(hitTest(900, sectors, ex, tol)).toEqual({ kind: 'move-sector', id: 's1' })
  })
  it('creates in empty space', () => {
    expect(hitTest(1500, sectors, ex, tol)).toEqual({ kind: 'create' })
  })
  it('prefers the nearest edge when two are close', () => {
    // 1210 is 10s from s1.end (1200) and 590s from s2.start → resize-end s1
    expect(hitTest(1210, sectors, ex, tol)).toEqual({ kind: 'resize-end', id: 's1' })
  })
})

describe('applyDrag', () => {
  it('resizes a sector end, clamped to min width', () => {
    const r = applyDrag({ kind: 'resize-end', id: 's1' }, sectors, ex, 1200, 610, 3600, 60)
    expect(r.sectors[0]!.range).toEqual({ startS: 600, endS: 660 }) // clamped to start+minWidth
  })
  it('resizes a sector start, clamped to min width', () => {
    const r = applyDrag({ kind: 'resize-start', id: 's1' }, sectors, ex, 600, 1190, 3600, 60)
    expect(r.sectors[0]!.range).toEqual({ startS: 1140, endS: 1200 }) // clamped to end-minWidth
  })
  it('moves a sector preserving width, clamped to bounds', () => {
    const r = applyDrag({ kind: 'move-sector', id: 's2' }, sectors, ex, 2100, 3600, 3600, 60)
    // width 600, delta would push end past 3600 → clamp end to 3600
    expect(r.sectors[1]!.range).toEqual({ startS: 3000, endS: 3600 })
  })
  it('drags the warmup trim without crossing cooldown', () => {
    const r = applyDrag({ kind: 'trim-warmup' }, sectors, ex, 300, 5000, 3600, 60)
    expect(r.exclusions).toEqual({ warmupEndS: 3240, cooldownStartS: 3300 }) // cooldown-minWidth
  })
  it('drags the cooldown trim without crossing warmup', () => {
    const r = applyDrag({ kind: 'trim-cooldown' }, sectors, ex, 3300, 100, 3600, 60)
    expect(r.exclusions).toEqual({ warmupEndS: 300, cooldownStartS: 360 }) // warmup+minWidth
  })
  it('leaves other sectors untouched', () => {
    const r = applyDrag({ kind: 'move-sector', id: 's1' }, sectors, ex, 900, 1000, 3600, 60)
    expect(r.sectors[1]).toEqual(sectors[1])
  })
})

describe('createSector', () => {
  it('builds a clamped sector from a dragged range', () => {
    const s = createSector('n1', 2600, 3000, 3600, 60)
    expect(s).toEqual({
      id: 'n1',
      activityId: '',
      range: { startS: 2600, endS: 3000 },
      label: '',
      kind: 'sector',
    })
  })
  it('normalizes reversed drags', () => {
    expect(createSector('n1', 3000, 2600, 3600, 60)!.range).toEqual({ startS: 2600, endS: 3000 })
  })
  it('rejects a too-small drag', () => {
    expect(createSector('n1', 2600, 2610, 3600, 60)).toBeNull()
  })
  it('clamps to the activity bounds', () => {
    expect(createSector('n1', -100, 4000, 3600, 60)!.range).toEqual({ startS: 0, endS: 3600 })
  })
})

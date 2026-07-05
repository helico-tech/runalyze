import { describe, expect, it } from 'vitest'
import { polyline, scalePoints } from './trends-geometry'

describe('scalePoints', () => {
  it('maps ascending points into the padded box, y inverted', () => {
    const s = scalePoints(
      [
        { t: 0, v: 0 },
        { t: 10, v: 100 },
      ],
      120,
      100,
      10,
    )
    expect(s[0]).toEqual({ x: 10, y: 90 }) // min value at bottom
    expect(s[1]).toEqual({ x: 110, y: 10 }) // max value at top
  })

  it('centers a single point', () => {
    const s = scalePoints([{ t: 5, v: 42 }], 120, 100, 10)
    expect(s[0]!.x).toBe(60)
    expect(s[0]!.y).toBe(50)
  })

  it('centers a flat series vertically', () => {
    const s = scalePoints(
      [
        { t: 0, v: 50 },
        { t: 10, v: 50 },
      ],
      120,
      100,
      10,
    )
    expect(s[0]!.y).toBe(50)
    expect(s[1]!.y).toBe(50)
  })

  it('honors an explicit y range', () => {
    const s = scalePoints(
      [
        { t: 0, v: 5 },
        { t: 10, v: 5 },
      ],
      120,
      100,
      10,
      0,
      10,
    )
    expect(s[0]!.y).toBe(50) // v=5 halfway in [0,10]
  })
})

describe('polyline', () => {
  it('joins scaled points', () => {
    expect(
      polyline([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe('1,2 3,4')
  })
})

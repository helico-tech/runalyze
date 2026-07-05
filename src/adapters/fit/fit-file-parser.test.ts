import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { fixtureBytes } from '../testing/fixtures'
import { sha256Hex } from './hash'
import { GarminFitFileParser } from './fit-file-parser'

const parser = new GarminFitFileParser()

describe('GarminFitFileParser', () => {
  it('parses a single .fit file with content-hash id', async () => {
    const bytes = fixtureBytes('Activity.fit')
    const outcomes = await parser.parse(bytes, 'Activity.fit')
    expect(outcomes).toHaveLength(1)
    const o = outcomes[0]!
    if (!o.ok) throw new Error(o.reason)
    expect(o.filename).toBe('Activity.fit')
    expect(o.activity.id).toBe(await sha256Hex(bytes))
    expect(o.rawBytes).toBe(bytes)
  })

  it('parses every .fit entry of a zip', async () => {
    const outcomes = await parser.parse(fixtureBytes('activities.zip'), 'activities.zip')
    expect(outcomes).toHaveLength(2)
    expect(outcomes.every((o) => o.ok)).toBe(true)
    const names = outcomes.map((o) => o.filename).sort()
    expect(names).toEqual(['Activity.fit', 'WithGearChangeData.fit'])
    const ids = new Set(outcomes.map((o) => (o.ok ? o.activity.id : '')))
    expect(ids.size).toBe(2)
  })

  it('isolates bad entries inside a zip', async () => {
    const zip = zipSync({
      'good.fit': fixtureBytes('Activity.fit'),
      'bad.fit': fixtureBytes('corrupt.fit'),
    })
    const outcomes = await parser.parse(zip, 'mixed.zip')
    expect(outcomes).toHaveLength(2)
    const good = outcomes.find((o) => o.filename === 'good.fit')!
    const bad = outcomes.find((o) => o.filename === 'bad.fit')!
    expect(good.ok).toBe(true)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toMatch(/FIT/)
  })

  it('reports a zip with no .fit entries', async () => {
    const zip = zipSync({ 'readme.txt': new TextEncoder().encode('hello') })
    const outcomes = await parser.parse(zip, 'empty.zip')
    expect(outcomes).toEqual([
      { ok: false, filename: 'empty.zip', reason: 'zip contains no .fit files' },
    ])
  })

  it('reports an unreadable zip', async () => {
    const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])
    const outcomes = await parser.parse(junk, 'broken.zip')
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]!.ok).toBe(false)
  })

  it('reports a non-FIT single file', async () => {
    const outcomes = await parser.parse(fixtureBytes('not-a-fit.txt'), 'not-a-fit.txt')
    expect(outcomes).toHaveLength(1)
    const o = outcomes[0]!
    expect(o.ok).toBe(false)
    if (!o.ok) expect(o.reason).toMatch(/not a FIT/)
  })
})
